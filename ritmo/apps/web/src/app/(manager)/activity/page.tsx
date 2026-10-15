import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { addDays } from '@ritmo/core';
import { ActivityBar, Banner, EmptyState, buttonClass, type Segment } from '@ritmo/ui';
import { AppFrame } from '@/components/AppFrame';
import { Icon } from '@/components/Icon';
import { requireManager } from '@/server/context';
import { activityDay, parseDate, type ActivityRow } from '@/server/time-queries';
import { fmtDuration, fmtLongDate, fmtTime, iso, todayLocal } from '@/lib/format';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('activity'))('title') };
}

/** Segments on a shared time axis, with gaps, so rows line up with each other. */
function toBar(row: ActivityRow, from: number, to: number): Segment[] {
  const out: Segment[] = [];
  let cursor = from;
  for (const s of row.segments) {
    const start = s.start.getTime();
    const end = s.end.getTime();
    if (start > cursor) out.push({ kind: 'empty', weight: (start - cursor) / 60000 });
    out.push({ kind: s.kind, weight: Math.max(1, (end - Math.max(start, cursor)) / 60000) });
    cursor = Math.max(cursor, end);
  }
  if (to > cursor) out.push({ kind: 'empty', weight: (to - cursor) / 60000 });
  return out;
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const ctx = await requireManager();
  const t = await getTranslations('activity');
  const locale = await getLocale();
  const tz = ctx.member.timezone;
  const { date } = await searchParams;
  const day = parseDate(date);
  const rows = await activityDay(ctx, day);
  const starts = rows.flatMap((r) => r.segments.map((s) => s.start.getTime()));
  const ends = rows.flatMap((r) => r.segments.map((s) => s.end.getTime()));
  const from = starts.length ? Math.min(...starts) : 0;
  const to = ends.length ? Math.max(...ends) : 0;
  const isToday = day === todayLocal(tz);

  return (
    <AppFrame ctx={ctx} crumb={t('title')}>
      <div className="head m-enter">
        <div>
          <h1 className="t-h1">{t('title')}</h1>
          <p className="head__sub">{t('subtitle')}</p>
        </div>
        <div className="head__actions">
          <div className="weeknav" role="group" aria-label={t('dayNav')}>
            <Link className={buttonClass('ghost', 'md', true)} href={`/activity?date=${addDays(day, -1)}`} aria-label={fmtLongDate(addDays(day, -1), locale, tz)}>
              <Icon name={locale === 'he' ? 'chevronNext' : 'chevron'} />
            </Link>
            <span className="weeknav__label">{fmtLongDate(day, locale, tz)}</span>
            {!isToday && (
              <Link className={buttonClass('ghost', 'md', true)} href={`/activity?date=${addDays(day, 1)}`} aria-label={fmtLongDate(addDays(day, 1), locale, tz)}>
                <Icon name={locale === 'he' ? 'chevron' : 'chevronNext'} />
              </Link>
            )}
          </div>
          <Link className={buttonClass('secondary')} href="/me/collected">
            <Icon name="shield" size={16} />
            {t('whatsCollected')}
          </Link>
        </div>
      </div>

      <Banner tone="info" icon={<Icon name="monitor" />}>
        {t('agentNote')}
      </Banner>

      <section className="panel m-enter" aria-labelledby="act-title" style={{ marginBlockStart: 'var(--space-5)' }}>
        <div className="panel__head">
          <h2 id="act-title">{fmtLongDate(day, locale, tz)}</h2>
          {rows.length > 0 && (
            <span className="muted t-caption" style={{ marginInlineStart: 'auto' }}>
              <bdi>{`${fmtTime(new Date(from), tz)}–${fmtTime(new Date(to), tz)}`}</bdi>
            </span>
          )}
        </div>
        {rows.length === 0 ? (
          <EmptyState title={t('empty')}>{t('emptyBody')}</EmptyState>
        ) : (
          <>
            <div className="act-rows m-stagger">
              {rows.map((r) => {
                const totals = t('totals', { active: iso(fmtDuration(r.active)), idle: iso(fmtDuration(r.idle)) });
                return (
                  <div key={r.memberId} className="act-row">
                    <div>
                      <b>{r.name}</b>
                      {r.title && <div className="t-caption muted">{r.title}</div>}
                    </div>
                    <ActivityBar segments={toBar(r, from, to)} label={`${r.name}: ${totals}`} />
                    <span className="t-caption muted">{totals}</span>
                    {r.apps.length > 0 && (
                      <div className="act-row__apps" aria-label={t('topApps')}>
                        {r.apps.map((a) => (
                          <span key={a.app} className="act-chip">
                            <span dir="auto">{a.app}</span>
                            <bdi className="muted">{fmtDuration(a.minutes)}</bdi>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="act-legend" aria-label={t('legend')}>
              <span><i style={{ background: 'var(--track-focus)' }} />{t('focus')}</span>
              <span><i style={{ background: 'var(--track-neutral)' }} />{t('neutral')}</span>
              <span><i style={{ background: 'repeating-linear-gradient(135deg, var(--track-idle) 0 2px, transparent 2px 4px)' }} />{t('idle')}</span>
              <span><i style={{ background: 'var(--beat)' }} />{t('break')}</span>
            </div>
          </>
        )}
      </section>
    </AppFrame>
  );
}
