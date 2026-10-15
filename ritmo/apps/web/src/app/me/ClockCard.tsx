'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { formatTimer } from '@ritmo/core';
import { TrackingIndicator, useToast } from '@ritmo/ui';
import { Icon } from '@/components/Icon';
import { fmtDuration, fmtTime } from '@/lib/format';
import { clockIn, clockOut, toggleBreak, type MeError } from './actions';

export interface ClockCardProps {
  state: 'out' | 'in' | 'break';
  label: string;
  geoLine: string | null;
  serverNow: string;
  startedAt: string | null;
  breakMinutes: number;
  breakStartedAt: string | null;
  closedSecondsToday: number;
  tracking: boolean;
  timezone: string;
}

type Position = { lat: number; lng: number; accuracy: number | null } | null;

/** Browser position for the geofence check, asked only at the moment of clocking in. */
function locate(): Promise<Position> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function haptic() {
  try {
    if (!reducedMotion()) navigator.vibrate?.([12, 40, 18]);
  } catch {
    // Vibration is a nicety; some browsers throw without a user gesture.
  }
}

export function ClockCard(props: ClockCardProps) {
  const t = useTranslations('me');
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<'locating' | 'saving' | null>(null);
  const [ring, setRing] = useState(false);
  const [rise, setRise] = useState(false);
  // Clock skew: tick from the server's clock, not the device's.
  const [offset] = useState(() => Date.parse(props.serverNow) - Date.now());
  const [tickMs, setTickMs] = useState(() => Date.parse(props.serverNow));
  useEffect(() => {
    if (props.state !== 'in') return;
    const id = window.setInterval(() => setTickMs(Date.now() + offset), 1000);
    return () => window.clearInterval(id);
  }, [props.state, offset]);
  // While working the timer runs; on break or off shift it shows the server's snapshot.
  const nowMs = props.state === 'in' ? Math.max(tickMs, Date.parse(props.serverNow)) : Date.parse(props.serverNow);
  let secs = props.closedSecondsToday;
  if (props.state !== 'out' && props.startedAt) {
    const runningBreak = props.breakStartedAt ? (nowMs - Date.parse(props.breakStartedAt)) / 1000 : 0;
    secs += (nowMs - Date.parse(props.startedAt)) / 1000 - props.breakMinutes * 60 - runningBreak;
  }

  // When the server confirms a new state: the timer rises in once (out → in), and the
  // ring with its "clock out" label, which only bridged the wait, goes away.
  const [seenState, setSeenState] = useState(props.state);
  if (seenState !== props.state) {
    setSeenState(props.state);
    setRing(false);
    setRise(seenState === 'out' && !reducedMotion());
  }

  const errorText = (e: MeError) =>
    e === 'alreadyIn' ? t('alreadyIn') : e === 'notIn' ? t('notIn') : e === 'geoBlocked' ? t('geoBlocked') : t('error');

  const onClockIn = async () => {
    setBusy('locating');
    const position = await locate();
    setBusy('saving');
    const res = await clockIn({ eventId: crypto.randomUUID(), position });
    setBusy(null);
    if (!res.ok) {
      toast.show(errorText(res.error));
      if (res.error === 'alreadyIn') startTransition(() => router.refresh());
      return;
    }
    haptic();
    setRing(true);
    toast.show(t('clockedIn', { time: fmtTime(res.startedAt, props.timezone) }));
    window.setTimeout(() => startTransition(() => router.refresh()), reducedMotion() ? 0 : 200);
  };

  const onBreak = async () => {
    setBusy('saving');
    const res = await toggleBreak({ eventId: crypto.randomUUID() });
    setBusy(null);
    if (!res.ok) return toast.show(errorText(res.error));
    toast.show(res.onBreak ? t('breakStarted') : t('breakEnded'));
    startTransition(() => router.refresh());
  };

  const onClockOut = async () => {
    setBusy('saving');
    const res = await clockOut({ eventId: crypto.randomUUID() });
    setBusy(null);
    if (!res.ok) return toast.show(errorText(res.error));
    haptic();
    toast.show(t('clockedOut', { duration: fmtDuration(res.workedMinutes) }));
    startTransition(() => router.refresh());
  };

  const working = busy !== null || pending;
  const geo = busy === 'locating' ? t('geoChecking') : props.geoLine;

  return (
    <section className="hero m-enter" aria-live="polite">
      <div>
        <div className="hero__label">{props.label}</div>
        <div
          key={props.state === 'out' ? 'out' : 'in'}
          className={`hero__timer${rise ? ' m-enter' : ''}${props.state === 'break' ? ' is-paused' : ''}`}
          role="timer"
          aria-label={t('workTimeToday')}
        >
          {formatTimer(secs)}
        </div>
      </div>
      {geo && (
        <div className="hero__geo">
          <Icon name="pin" size={15} />
          {geo}
        </div>
      )}
      {props.tracking && props.state !== 'out' && (
        <span className="hero__tracking">
          <TrackingIndicator paused={props.state === 'break'}>{t('trackingOn')}</TrackingIndicator>
        </span>
      )}
      {props.state === 'out' ? (
        <button
          type="button"
          className={`rt-btn rt-btn--lg ${ring ? 'rt-btn--beat m-ring' : 'rt-btn--pulse'}`}
          onClick={onClockIn}
          disabled={working}
          aria-busy={working}
        >
          <Icon name="play" />
          {ring ? t('clockOut') : t('clockIn')}
        </button>
      ) : (
        <div className="hero__row">
          <button type="button" className="rt-btn rt-btn--onhero rt-btn--lg" onClick={onBreak} disabled={working} aria-busy={working}>
            <Icon name="coffee" />
            {props.state === 'break' ? t('breakEnd') : t('breakStart')}
          </button>
          <button type="button" className="rt-btn rt-btn--beat rt-btn--lg" onClick={onClockOut} disabled={working} aria-busy={working}>
            {t('clockOut')}
          </button>
        </div>
      )}
    </section>
  );
}
