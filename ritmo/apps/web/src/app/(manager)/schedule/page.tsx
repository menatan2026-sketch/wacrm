import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { EmptyState, Num, Stat, Stats, Status, buttonClass } from '@ritmo/ui';
import { addDays, localDate, weekDates, weekNumber, weekStart } from '@ritmo/core';
import { AppFrame } from '@/components/AppFrame';
import { Icon } from '@/components/Icon';
import { requireManager } from '@/server/context';
import { fmtMoney, fmtRange, fmtTime, fmtWeekday, iso, pct, todayLocal } from '@/lib/format';
import { RequestItem } from '../overview/NeedsYou';
import { scheduleWeek } from './data';
import { NewShiftButton, ScheduleBoard } from './ScheduleBoard';
import { PublishButton } from './PublishButton';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('nav'))('schedule') };
}

type Search = { loc?: string; week?: string; new?: string };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireManager();
  const sp = await searchParams;
  const t = await getTranslations('schedule');
  const tn = await getTranslations('nav');
  const tc = await getTranslations('common');
  const to = await getTranslations('overview');
  const locale = await getLocale();
  const today = todayLocal();
  const ws = weekStart(sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today);
  const d = await scheduleWeek(ctx, ws, sp.loc);
  const loc = d.location;

  if (!loc) {
    return (
      <AppFrame ctx={ctx} crumb={tn('schedule')}>
        <div className="head m-enter"><h1 className="t-h1">{tn('schedule')}</h1></div>
        <EmptyState title={t('noLocations')}>{t('noLocationsBody')}</EmptyState>
      </AppFrame>
    );
  }

  const href = (q: { loc?: string; week?: string }) => `/schedule?${new URLSearchParams({ loc: q.loc ?? loc.id, week: q.week ?? ws })}`;
  const days = weekDates(ws).map((date) => ({
    date,
    label: `${Number(date.slice(8))}.${Number(date.slice(5, 7))}`,
    short: locale === 'he' ? `${fmtWeekday(date, locale, 'narrow')}׳` : fmtWeekday(date, locale, 'short'),
    today: date === today,
  }));

  const drafts = d.shifts.filter((s) => s.draft).length;
  const assigned = d.shifts.filter((s) => s.memberId);
  const scheduled = d.members.reduce((s, m) => s + m.scheduledMinutes, 0);
  const contracted = d.members.reduce((s, m) => s + (m.contractMinutes ?? 0), 0);
  const open = d.shifts.length - assigned.length;
  const conflicts = d.shifts.filter((s) => s.conflict);
  const budgetPct = loc.budgetMinor > 0 ? (d.costMinor / loc.budgetMinor) * 100 : null;
  const hours = (m: number) => Math.round(m / 60);

  return (
    <AppFrame ctx={ctx} crumb={`${tn('schedule')} · ${loc.name}`}>
      <div className="head m-enter">
        <div>
          <h1 className="t-h1">{t('title', { number: weekNumber(ws) })}</h1>
          <p className="head__sub">
            <Num>{fmtRange(ws, addDays(ws, 6), locale)}</Num> · {loc.name} ·{' '}
            {drafts > 0 ? <Status tone="pending">{t('draftStatus', { count: drafts })}</Status> : <Status tone="on">{t('allPublished')}</Status>}
          </p>
        </div>
        <div className="head__actions">
          {d.locations.length > 1 && (
            <nav className="rt-seg" aria-label={t('pickLocation')}>
              {d.locations.map((l) => (
                <Link key={l.id} href={href({ loc: l.id })} className="seg-link" aria-current={l.id === loc.id ? 'page' : undefined}>
                  {l.name}
                </Link>
              ))}
            </nav>
          )}
          <div className="week-nav">
            <Link className={buttonClass('secondary', 'md', true)} href={href({ week: addDays(ws, -7) })} aria-label={tc('previousWeek')}>
              <Icon name="chevronNext" className="rtl-flip" />
            </Link>
            <Link className={buttonClass('secondary')} href={href({ week: weekStart(today) })} aria-current={ws === weekStart(today) ? 'date' : undefined}>
              {tc('today')}
            </Link>
            <Link className={buttonClass('secondary', 'md', true)} href={href({ week: addDays(ws, 7) })} aria-label={tc('nextWeek')}>
              <Icon name="chevron" className="rtl-flip" />
            </Link>
          </div>
          <NewShiftButton label={t('addShift')} />
          <PublishButton locationId={loc.id} weekStart={ws} />
        </div>
      </div>

      <Stats label={t('statsLabel')}>
        <Stat
          label={t('plannedCost')}
          value={<Num>{fmtMoney(d.costMinor, locale)}</Num>}
          meter={budgetPct !== null ? { value: budgetPct, warn: budgetPct > 100, label: t('ofBudget', { percent: pct(budgetPct), budget: fmtMoney(loc.budgetMinor, locale) }) } : undefined}
          deltaTone={budgetPct !== null && budgetPct > 100 ? 'warn' : undefined}
          delta={budgetPct !== null ? t('ofBudget', { percent: iso(pct(budgetPct)), budget: iso(fmtMoney(loc.budgetMinor, locale)) }) : to('noBudget')}
        />
        <Stat
          label={t('scheduledHours')}
          value={<Num>{hours(scheduled)}</Num>}
          unit={contracted > 0 ? <Num>/ {hours(contracted)}</Num> : undefined}
          delta={contracted > 0 ? t('ofContracted', { hours: iso(hours(contracted)) }) : null}
        />
        <Stat label={t('openShifts')} value={<Num>{open}</Num>} delta={t('openCount', { count: open })} />
        <Stat
          label={t('conflicts')}
          value={<Num>{conflicts.length}</Num>}
          deltaTone={conflicts.length ? 'warn' : undefined}
          delta={
            conflicts.length
              ? <><Icon name="alert" size={12} /> {t('conflictSummary', {
                  overlap: conflicts.filter((c) => c.conflict === 'overlap').length,
                  rest: conflicts.filter((c) => c.conflict === 'short_rest').length,
                })}</>
              : t('noConflicts')
          }
        />
      </Stats>

      <div className="sched-layout">
        <section className="panel m-enter" aria-label={t('title', { number: weekNumber(ws) })}>
          {d.members.length === 0 && d.shifts.length === 0 ? (
            <EmptyState title={t('noMembers')}>{t('noMembersBody')}</EmptyState>
          ) : (
            <ScheduleBoard
              locationId={loc.id}
              days={days}
              members={d.members}
              positions={d.positions}
              shifts={d.shifts}
              openNew={sp.new === '1'}
            />
          )}
        </section>

        {d.requests.length > 0 && (
          <section className="panel m-enter" aria-labelledby="req-title">
            <div className="panel__head">
              <h2 id="req-title">{t('requestsTitle')}</h2>
              <span className="rt-count">{d.requests.length}</span>
            </div>
            <ul className="todo m-stagger">
              {d.requests.map((r) => {
                const day = fmtWeekday(localDate(r.startsAt), locale);
                const title =
                  r.kind === 'swap' ? to('swapRequest', { a: r.requester, b: r.target ?? '', day })
                    : r.kind === 'claim' ? to('claimRequest', { name: r.requester, day })
                      : to('dropRequest', { name: r.requester, day });
                return (
                  <RequestItem key={r.id} id={r.id} title={title}
                    detail={<><Num>{`${fmtTime(r.startsAt)}–${fmtTime(r.endsAt)}`}</Num> · {loc.name}</>} />
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </AppFrame>
  );
}
