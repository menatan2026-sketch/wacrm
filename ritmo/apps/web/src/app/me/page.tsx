import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Banner, buttonClass } from '@ritmo/ui';
import { Icon } from '@/components/Icon';
import { requireCtx } from '@/server/context';
import { todayData } from '@/server/me-queries';
import { fmtDuration, fmtLongDate, fmtMoney, fmtTime, iso } from '@/lib/format';
import { ClockCard } from './ClockCard';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('me'))('tabToday') };
}

function partOfDay(tz: string): 'morning' | 'noon' | 'evening' | 'night' {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date()));
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'noon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export default async function TodayPage() {
  const ctx = await requireCtx();
  const t = await getTranslations('me');
  const locale = await getLocale();
  const tz = ctx.member.timezone;
  const d = await todayData(ctx);
  const range = (a: Date, b: Date) => iso(`${fmtTime(a, tz)}–${fmtTime(b, tz)}`);

  const state = !d.open ? 'out' : d.open.break_started_at ? 'break' : 'in';
  const label =
    state === 'in'
      ? t('onShiftSince', { time: iso(fmtTime(d.open!.started_at, tz)), location: d.open!.location_name ?? '' })
      : state === 'break'
        ? t('onBreakSince', { time: iso(fmtTime(d.open!.break_started_at, tz)) })
        : d.shift
          ? t('shiftLabel', {
              when: d.shift.position_name ?? t('todayTab'),
              location: d.shift.location_name,
              time: range(d.shift.starts_at, d.shift.ends_at),
            })
          : t('noShiftToday');

  let geoLine: string | null = null;
  if (d.lastClockIn) {
    const c = d.lastClockIn;
    if (c.inside_geofence === true) geoLine = t('geoInside', { accuracy: iso(Math.round(c.accuracy_m ?? 0)) });
    else if (c.inside_geofence === false) geoLine = t('geoOutside', { distance: iso(c.distance_m ?? 0) });
    else if (c.accuracy_m === null) geoLine = t('geoDenied');
  } else if (state === 'out') {
    geoLine = t('geoPrompt');
  }

  return (
    <>
      <div className="ptop">
        <h1>
          {t('greeting', { part: t(partOfDay(tz)), name: ctx.member.firstName })}
          <span className="sub">{fmtLongDate(new Date(), locale, tz)}</span>
        </h1>
        {ctx.isManager && (
          <Link href="/overview" className={buttonClass('ghost', 'sm')}>
            {t('managerView')}
          </Link>
        )}
      </div>

      {d.swapBanner && (
        <section className="psec" style={{ marginBlockEnd: 'var(--space-4)' }}>
          <Banner tone="warning" icon={<Icon name="swap" />}>
            <b>
              {t('swapPendingBanner', {
                name: d.swapBanner.name,
                day: new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', { weekday: 'long', timeZone: tz }).format(d.swapBanner.day),
              })}
            </b>
            <div className="muted" style={{ fontSize: 13 }}>
              {t('swapPending')}
            </div>
          </Banner>
        </section>
      )}

      <ClockCard
        state={state}
        label={label}
        geoLine={geoLine}
        serverNow={new Date().toISOString()}
        startedAt={d.open?.started_at.toISOString() ?? null}
        breakMinutes={d.open?.break_minutes ?? 0}
        breakStartedAt={d.open?.break_started_at?.toISOString() ?? null}
        closedSecondsToday={d.closedSecondsToday}
        tracking={ctx.member.worksOn !== 'site'}
        timezone={tz}
      />

      <section className="psec">
        <div className="psec__title">{t('week')}</div>
        <div className="plist">
          <div>
            <div className="plist__main">
              <b>{t('hours')}</b>
              <span>{t('ofScheduled', { hours: iso(fmtDuration(d.scheduledMinutes)) })}</span>
            </div>
            <span className="t-figure rt-num">{fmtDuration(d.week.total)}</span>
          </div>
          {d.rateMinor > 0 && (
            <div>
              <div className="plist__main">
                <b>{t('estPay')}</b>
                <span>{t('beforeDeductions', { rate: iso(fmtMoney(d.rateMinor, locale)) })}</span>
              </div>
              <span className="t-figure rt-num">{fmtMoney(d.estPayMinor, locale)}</span>
            </div>
          )}
        </div>
      </section>

      <section className="psec">
        <div className="psec__title">{t('nextShift')}</div>
        <div className="plist">
          {d.next ? (
            <Link href="/me/shifts" className="mrow-link">
              <div className="plist__main">
                <b>
                  {new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: tz }).format(d.next.starts_at)}
                  {' · '}
                  <span className="rt-num">{`${fmtTime(d.next.starts_at, tz)}–${fmtTime(d.next.ends_at, tz)}`}</span>
                </b>
                <span>
                  {[d.next.position_name, d.next.location_name].filter(Boolean).join(' · ')}
                </span>
              </div>
              <Icon name={locale === 'he' ? 'chevron' : 'chevronNext'} />
            </Link>
          ) : (
            <div>
              <div className="plist__main">
                <span>{t('noUpcoming')}</span>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
