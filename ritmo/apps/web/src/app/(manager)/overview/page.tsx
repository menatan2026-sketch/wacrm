import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ActivityBar, Num, Stat, Stats, TrackingIndicator, buttonClass } from '@ritmo/ui';
import { weekNumber } from '@ritmo/core';
import { AppFrame } from '@/components/AppFrame';
import { Icon } from '@/components/Icon';
import { requireManager } from '@/server/context';
import { locations, overview } from '@/server/queries';
import { fmtDuration, fmtLongDate, fmtMoney, fmtTime, fmtWeekday, iso, pct, todayLocal } from '@/lib/format';
import { OnShiftTable } from './OnShiftTable';
import { RequestItem, GeofenceItem } from './NeedsYou';
import { localDate } from '@ritmo/core';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('overview'))('title') };
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ loc?: string }> }) {
  const ctx = await requireManager();
  const t = await getTranslations('overview');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const { loc } = await searchParams;
  const locs = await locations(ctx);
  const current = locs.find((l) => l.id === loc) ?? null;
  const d = await overview(ctx, current?.id ?? null);
  const branches = locs.filter((l) => l.kind === 'branch');

  const hoursDelta = d.hoursLastWeekSamePoint > 0 ? ((d.hoursWeek - d.hoursLastWeekSamePoint) / d.hoursLastWeekSamePoint) * 100 : null;
  const otDelta = d.overtimeLastWeek > 0 ? ((d.overtimeWeek - d.overtimeLastWeek) / d.overtimeLastWeek) * 100 : null;
  const budgetPct = d.budgetMinor > 0 ? (d.payrollMinor / d.budgetMinor) * 100 : null;
  const signed = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n)}%`;
  const needsCount = d.requests.length + d.geofence.length + (d.pendingTimesheets.count > 0 ? 1 : 0);

  return (
    <AppFrame ctx={ctx} crumb={t('title')}>
      <div className="head m-enter">
        <div>
          <h1 className="t-h1">{t('title')}</h1>
          <p className="head__sub">{t('scope', { date: fmtLongDate(todayLocal(), locale), scope: current?.name ?? tc('allLocations') })}</p>
        </div>
        <div className="head__actions">
          <nav className="rt-seg" aria-label={tc('allLocations')}>
            <Link href="/overview" aria-current={!current ? 'page' : undefined} className="rt-seg-link" style={segStyle(!current)}>
              {tc('allLocations')}
            </Link>
            {branches.map((b) => (
              <Link key={b.id} href={`/overview?loc=${b.id}`} aria-current={current?.id === b.id ? 'page' : undefined} style={segStyle(current?.id === b.id)}>
                {b.name}
              </Link>
            ))}
          </nav>
          <a className={buttonClass('secondary')} href={`/api/export/payroll${current ? `?loc=${current.id}` : ''}`}>
            <Icon name="download" size={16} />
            {t('exportPayroll')}
          </a>
          <Link className={buttonClass('primary')} href={`/schedule?new=1${current ? `&loc=${current.id}` : ''}`}>
            <Icon name="plus" size={16} />
            {t('newShift')}
          </Link>
        </div>
      </div>

      <Stats label={t('statsLabel')}>
        <Stat
          label={t('onShiftNow')}
          value={<Num>{d.onShift.length}</Num>}
          unit={<Num>/ {d.onShift.length + d.notInYet}</Num>}
          spark={d.dailyPeople}
          delta={d.notInYet > 0 ? t('notInYet', { count: d.notInYet }) : t('allIn')}
        />
        <Stat
          label={t('hoursThisWeek')}
          value={<Num>{Math.round(d.hoursWeek / 60).toLocaleString(locale === 'he' ? 'he-IL' : 'en-IL')}</Num>}
          spark={d.dailyHours}
          deltaTone={hoursDelta !== null && hoursDelta >= 0 ? 'up' : undefined}
          delta={hoursDelta !== null ? <><b><Num>{signed(hoursDelta)}</Num></b> {t('vsLastWeek')}</> : null}
        />
        <Stat
          label={t('overtime')}
          value={<Num>{Math.round(d.overtimeWeek / 60)}</Num>}
          unit={tc('hoursUnit')}
          spark={d.dailyOvertime}
          sparkTone="warn"
          deltaTone="warn"
          delta={
            otDelta !== null ? (
              <><b><Num>{signed(otDelta)}</Num></b>{d.overtimeTopLocation && !current ? ` · ${t('mostlyIn', { location: d.overtimeTopLocation })}` : ''}</>
            ) : null
          }
        />
        <Stat
          label={t('payrollThisWeek')}
          value={<Num>{fmtMoney(d.payrollMinor, locale)}</Num>}
          meter={budgetPct !== null ? { value: budgetPct, label: t('ofBudget', { percent: pct(budgetPct), budget: fmtMoney(d.budgetMinor, locale) }), warn: budgetPct > 100 } : undefined}
          delta={budgetPct !== null ? t('ofBudget', { percent: iso(pct(budgetPct)), budget: iso(fmtMoney(d.budgetMinor, locale)) }) : t('noBudget')}
        />
      </Stats>

      <div className="cols">
        <OnShiftTable
          rows={d.onShift.map((r) => ({
            id: r.entryId,
            name: `${r.firstName} ${r.lastName}`,
            initials: `${r.firstName[0] ?? ''}${r.lastName[0] ?? ''}`,
            tint: r.avatarColor,
            role: r.position ?? '',
            location: r.location ?? '',
            in: fmtTime(r.startedAt),
            today: fmtDuration(r.workedMinutes),
            lateMinutes: r.shiftStart ? Math.max(0, Math.round((r.startedAt.getTime() - r.shiftStart.getTime()) / 60000)) : 0,
            breakMinutes: r.breakStartedAt ? Math.round((Date.now() - r.breakStartedAt.getTime()) / 60000) : null,
            computer: r.source === 'desktop',
          }))}
          graceMinutes={ctx.member.policy.lateGraceMinutes}
        />

        <div className="stack" style={{ gap: 24 }}>
          <section className="panel m-enter" aria-labelledby="needs-title">
            <div className="panel__head">
              <h2 id="needs-title">{t('needsYou')}</h2>
              {needsCount > 0 && <span className="rt-count">{needsCount}</span>}
            </div>
            {needsCount === 0 ? (
              <p className="panel__body muted">{t('nothingNeedsYou')}</p>
            ) : (
              <ul className="todo m-stagger">
                {d.requests.map((r) => {
                  const day = fmtWeekday(localDate(r.startsAt), locale);
                  const title =
                    r.kind === 'swap'
                      ? t('swapRequest', { a: r.requester, b: r.target ?? '', day })
                      : r.kind === 'claim'
                        ? t('claimRequest', { name: r.requester, day })
                        : t('dropRequest', { name: r.requester, day });
                  return (
                    <RequestItem
                      key={r.id}
                      id={r.id}
                      title={title}
                      detail={<><Num>{`${fmtTime(r.startsAt)}–${fmtTime(r.endsAt)}`}</Num> · {r.location}{r.kind === 'swap' ? ` · ${t('noCostImpact')}` : ''}</>}
                    />
                  );
                })}
                {d.geofence.map((g) => (
                  <GeofenceItem
                    key={g.id}
                    id={g.id}
                    title={t('outsideGeofence', { name: g.name })}
                    detail={t('outsideDetail', { time: iso(fmtTime(g.at)), distance: iso(g.distance), location: g.location })}
                  />
                ))}
                {d.pendingTimesheets.count > 0 && (
                  <li>
                    <span className="todo__ic"><Icon name="file" /></span>
                    <div className="todo__main">
                      <b>{t('timesheetsWaiting', { count: d.pendingTimesheets.count, week: weekNumber(d.pendingTimesheets.weekStart) })}</b>
                      <span>{t('timesheetsDetail', { ok: d.pendingTimesheets.count - d.pendingTimesheets.withIssues, issues: d.pendingTimesheets.withIssues })}</span>
                    </div>
                    <Link className={buttonClass('ghost', 'sm')} href={`/time?week=${d.pendingTimesheets.weekStart}`}>{t('go')}</Link>
                  </li>
                )}
              </ul>
            )}
          </section>

          <section className="panel m-enter" aria-labelledby="act-title">
            <div className="panel__head">
              <h2 id="act-title">{t('activityToday')}</h2>
              <div className="sp" />
              {d.activity.length > 0 && (
                <TrackingIndicator>
                  <b>{t('activeNow', { count: d.activity.filter((a) => a.live).length })}</b> · {t('workHoursOnly')}
                </TrackingIndicator>
              )}
            </div>
            <div className="panel__body stack" style={{ gap: 14 }}>
              {d.activity.length === 0 ? (
                <p className="muted">{t('noActivity')}</p>
              ) : (
                <ActivityPanel rows={d.activity} />
              )}
            </div>
          </section>
        </div>
      </div>
    </AppFrame>
  );
}

function segStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', blockSize: 28, paddingInline: 12, borderRadius: 6, fontSize: 13, fontWeight: 500,
    textDecoration: 'none', color: active ? 'var(--ink)' : 'var(--ink-muted)', background: active ? 'var(--surface)' : 'transparent',
    boxShadow: active ? 'var(--shadow-sm)' : undefined,
  };
}

async function ActivityPanel({ rows }: { rows: Awaited<ReturnType<typeof overview>>['activity'] }) {
  const ta = await getTranslations('activity');
  // Scale to a 9-hour workday so bars are comparable across people.
  const dayMinutes = 9 * 60;
  return (
    <>
      <div className="people-track">
        {rows.slice(0, 6).map((r) => {
          const used = r.segments.reduce((s, x) => s + x.minutes, 0);
          return (
            <PeopleTrackRow key={r.memberId} name={r.name} total={fmtDuration(r.activeMinutes)}
              label={`${r.name}: ${fmtDuration(r.activeMinutes)}`}
              segments={[...r.segments.map((s) => ({ kind: s.kind, weight: s.minutes })), { kind: 'empty' as const, weight: Math.max(0, dayMinutes - used) }]} />
          );
        })}
      </div>
      <div className="rt-legend">
        <span><i style={{ background: 'var(--track-focus)' }} />{ta('focus')}</span>
        <span><i style={{ background: 'var(--track-neutral)' }} />{ta('neutral')}</span>
        <span><i className="hatch" />{ta('idle')}</span>
        <span><i style={{ background: 'var(--beat)' }} />{ta('break')}</span>
      </div>
    </>
  );
}

function PeopleTrackRow({ name, total, label, segments }: { name: string; total: string; label: string; segments: Parameters<typeof ActivityBar>[0]['segments'] }) {
  return (
    <>
      <span>{name}</span>
      <ActivityBar segments={segments} label={label} />
      <span className="t"><Num>{total}</Num></span>
    </>
  );
}
