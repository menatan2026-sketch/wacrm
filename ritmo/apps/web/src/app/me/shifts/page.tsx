import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { addDays, shiftMinutes, weekDates, weekNumber, weekStart } from '@ritmo/core';
import { buttonClass, EmptyState } from '@ritmo/ui';
import { Icon } from '@/components/Icon';
import { requireCtx } from '@/server/context';
import { shiftsData } from '@/server/me-queries';
import { fmtDuration, fmtMoney, fmtTime, todayLocal } from '@/lib/format';
import { ClaimButton, SwapControl } from './ShiftControls';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('me'))('shiftsTitle') };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ week?: string; day?: string }> }) {
  const ctx = await requireCtx();
  const t = await getTranslations('me');
  const locale = await getLocale();
  const tz = ctx.member.timezone;
  const intl = locale === 'he' ? 'he-IL' : 'en-IL';
  const { week, day } = await searchParams;
  const today = todayLocal(tz);
  const ws = weekStart(week && DATE.test(week) ? week : today);
  const dates = weekDates(ws);
  const data = await shiftsData(ctx, ws);

  const localDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
  const withShift = new Set(data.shifts.map((s) => localDay(s.starts_at)));
  const selected =
    day && dates.includes(day) ? day : dates.includes(today) ? today : (dates.find((d) => withShift.has(d)) ?? ws);
  const dayShifts = data.shifts.filter((s) => localDay(s.starts_at) === selected);
  const now = new Date();
  const colleagues = data.colleagues.map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim() }));
  const weekday = (d: string, style: 'narrow' | 'long') =>
    new Intl.DateTimeFormat(intl, { weekday: style, timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const listFmt = new Intl.ListFormat(intl, { type: 'conjunction' });

  return (
    <>
      <div className="ptop">
        <h1>
          {t('shiftsTitle')}
          <span className="sub">{t('shiftsOfWeek', { number: weekNumber(ws) })}</span>
        </h1>
        <div className="weeknav">
          <Link href={`/me/shifts?week=${addDays(ws, -7)}`} className={buttonClass('ghost', 'md', true)} aria-label={t('prevWeek')}>
            <Icon name={locale === 'he' ? 'chevronNext' : 'chevron'} />
          </Link>
          <Link href={`/me/shifts?week=${addDays(ws, 7)}`} className={buttonClass('ghost', 'md', true)} aria-label={t('nextWeek')}>
            <Icon name={locale === 'he' ? 'chevron' : 'chevronNext'} />
          </Link>
        </div>
      </div>

      <nav className="daypick" aria-label={t('shiftsOfWeek', { number: weekNumber(ws) })}>
        {dates.map((d) => (
          <Link
            key={d}
            href={`/me/shifts?week=${ws}&day=${d}`}
            className={[d === selected ? 'on' : '', withShift.has(d) ? 'has' : ''].join(' ').trim() || undefined}
            aria-current={d === selected ? 'date' : undefined}
            aria-label={weekday(d, 'long')}
          >
            {weekday(d, 'narrow')}
            <b>{Number(d.slice(8))}</b>
            <i />
          </Link>
        ))}
      </nav>

      <section className="psec" style={{ marginBlockStart: 'var(--space-4)' }}>
        {dayShifts.length === 0 ? (
          <EmptyState title={t('noShiftsDay')} />
        ) : (
          <div className="plist">
            {dayShifts.map((s) => (
              <div key={s.id} className="mshift">
                <div className="mshift__head">
                  <div className="plist__main">
                    <b className="rt-num mshift__time">{`${fmtTime(s.starts_at, tz)}–${fmtTime(s.ends_at, tz)}`}</b>
                    <span>
                      {[s.position_name, s.location_name].filter(Boolean).join(' · ')}
                      {' · '}
                      <bdi>{fmtDuration(shiftMinutes({ startsAt: s.starts_at, endsAt: s.ends_at, breakMinutes: s.break_minutes }))}</bdi>
                    </span>
                  </div>
                  {s.position_name && <span className={`rt-shift rt-shift--${s.position_color ?? 'stone'}`}>{s.position_name}</span>}
                </div>
                <div className="mshift__team">
                  <Icon name="people" size={16} />
                  {s.teammates.length ? t('withTeam', { names: listFmt.format(s.teammates.slice(0, 4)) }) : t('alone')}
                </div>
                <SwapControl
                  shiftId={s.id}
                  colleagues={colleagues}
                  request={s.request ? { id: s.request.id, target: s.request.target } : null}
                  canRequest={s.starts_at > now}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="psec">
        <div className="psec__title">
          {t('openShiftsForYou')}
          <span className="rt-num">{data.open.length}</span>
        </div>
        {data.open.length === 0 ? (
          <div className="plist">
            <div>
              <div className="plist__main">
                <span>{t('noOpenShifts')}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="plist">
            {data.open.map((o) => (
              <div key={o.id}>
                <div className="plist__main">
                  <b>
                    <span className="rt-num">{`${fmtTime(o.starts_at, tz)}–${fmtTime(o.ends_at, tz)}`}</span>
                    {' · '}
                    {new Intl.DateTimeFormat(intl, { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: tz }).format(o.starts_at)}
                  </b>
                  <span>
                    {[o.position_name, o.location_name, t('spots', { count: o.spots })].filter(Boolean).join(' · ')}
                    {o.open_bonus_minor ? (
                      <>
                        {' · '}
                        <bdi>{t('bonus', { amount: fmtMoney(o.open_bonus_minor, locale) })}</bdi>
                      </>
                    ) : null}
                  </span>
                </div>
                <ClaimButton shiftId={o.id} requestId={o.claimed} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
