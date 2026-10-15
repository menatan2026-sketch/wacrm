import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { addDays, initials, localDate, weekNumber } from '@ritmo/core';
import { Avatar, EmptyState, Num, Pill, Stat, Stats, Status, buttonClass, type Tint } from '@ritmo/ui';
import { AppFrame } from '@/components/AppFrame';
import { Icon } from '@/components/Icon';
import { requireManager } from '@/server/context';
import { memberWeek, parseWeek } from '@/server/time-queries';
import { fmtDuration, fmtRange, fmtShortDate, fmtTime } from '@/lib/format';
import { ApproveButton, EditEntryButton, ResolveButton } from '../TimeControls';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('time'))('title') };
}

const UUID = /^[0-9a-f-]{36}$/i;

export default async function MemberTimePage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const ctx = await requireManager();
  const { memberId } = await params;
  if (!UUID.test(memberId)) notFound();
  const { week } = await searchParams;
  const ws = parseWeek(week);
  const t = await getTranslations('time');
  const tc = await getTranslations('common');
  const ts = await getTranslations('status');
  const to = await getTranslations('overview');
  const locale = await getLocale();
  const tz = ctx.member.timezone;
  const d = await memberWeek(ctx, memberId, ws);
  if (!d) notFound();
  const name = `${d.member.firstName} ${d.member.lastName}`.trim();
  const q = (w: string) => `/time/${memberId}?week=${w}`;
  const openAnomalies = d.anomalies.filter((a) => a.status === 'open');
  const anyRunning = d.entries.some((e) => !e.endedAt);
  const eventLabel = { clock_in: t('start'), clock_out: t('end'), break_start: t('colBreak'), break_end: t('colBreak') } as const;

  return (
    <AppFrame ctx={ctx} crumb={t('title')}>
      <div className="head m-enter">
        <div className="rt-person">
          <Avatar initials={initials(d.member.firstName, d.member.lastName)} tint={d.member.avatarColor as Tint} size="lg" />
          <div>
            <h1 className="t-h1">{t('detailTitle', { name })}</h1>
            <p className="head__sub">
              {[d.member.title, d.member.location].filter(Boolean).join(' · ')} · {tc('week', { number: weekNumber(ws) })} ·{' '}
              <bdi>{fmtRange(ws, addDays(ws, 6), locale)}</bdi>
            </p>
          </div>
        </div>
        <div className="head__actions">
          <Link className={buttonClass('ghost')} href={`/time?week=${ws}`}>
            <Icon name={locale === 'he' ? 'chevronNext' : 'chevron'} size={16} />
            {tc('back')}
          </Link>
          <div className="weeknav">
            <Link className={buttonClass('ghost', 'md', true)} href={q(addDays(ws, -7))} aria-label={tc('previousWeek')}>
              <Icon name={locale === 'he' ? 'chevronNext' : 'chevron'} />
            </Link>
            <Link className={buttonClass('ghost', 'md', true)} href={q(addDays(ws, 7))} aria-label={tc('nextWeek')}>
              <Icon name={locale === 'he' ? 'chevron' : 'chevronNext'} />
            </Link>
          </div>
          {d.approval === 'approved' ? (
            <Status tone="on">{ts('approved')}</Status>
          ) : (
            !d.isSelf && !anyRunning && d.entries.length > 0 && <ApproveButton memberId={memberId} week={ws} />
          )}
        </div>
      </div>

      <Stats label={t('statsLabel')}>
        <Stat label={t('colTotal')} value={<Num>{fmtDuration(d.totals.total)}</Num>} />
        <Stat label={t('colRegular')} value={<Num>{fmtDuration(d.totals.regular)}</Num>} />
        <Stat label={`${t('colOt1')} / ${t('colOt2')}`} value={<Num>{`${fmtDuration(d.totals.overtime1)} / ${fmtDuration(d.totals.overtime2)}`}</Num>} />
        <Stat label={t('colRest')} value={<Num>{fmtDuration(d.totals.restDay)}</Num>} />
      </Stats>

      <div className="two-col">
        <section className="panel m-enter" aria-labelledby="entries-title">
          <div className="panel__head">
            <h2 id="entries-title">{t('weekOf', { range: fmtRange(ws, addDays(ws, 6), locale) })}</h2>
          </div>
          {d.entries.length === 0 ? (
            <EmptyState title={t('noEntries')}>{t('noEntriesBody')}</EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="rt-table">
                <thead>
                  <tr>
                    <th scope="col">{t('colDate')}</th>
                    <th scope="col" className="num">{t('colIn')}</th>
                    <th scope="col" className="num">{t('colOut')}</th>
                    <th scope="col" className="num">{t('colBreak')}</th>
                    <th scope="col" className="num">{t('colWorked')}</th>
                    <th scope="col">{t('colSource')}</th>
                    <th scope="col">
                      <span className="sr-only">{t('editEntry')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {d.entries.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <bdi>{fmtShortDate(e.workDate, locale)}</bdi>
                        {e.editedReason && (
                          <div className="t-caption muted" title={e.editedReason}>
                            <Icon name="edit" size={12} /> {e.editedReason}
                          </div>
                        )}
                      </td>
                      <td className="num"><Num>{fmtTime(e.startedAt, tz)}</Num></td>
                      <td className="num">{e.endedAt ? <Num>{fmtTime(e.endedAt, tz)}</Num> : <Status tone="on">{t('running')}</Status>}</td>
                      <td className="num"><Num>{e.breakMinutes}</Num></td>
                      <td className="num"><b><Num>{fmtDuration(e.worked)}</Num></b></td>
                      <td className="muted">{e.source ? t(`source.${e.source as 'web'}`) : '—'}</td>
                      <td>
                        {e.endedAt && !d.isSelf && (
                          <EditEntryButton
                            entry={{
                              id: e.id,
                              date: fmtShortDate(e.workDate, locale),
                              start: fmtTime(e.startedAt, tz),
                              end: fmtTime(e.endedAt, tz),
                              breakMinutes: e.breakMinutes,
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="policy-note">{t('policyNote')}</p>
        </section>

        <div className="stack" style={{ gap: 'var(--space-5)' }}>
          <section className="panel m-enter" aria-labelledby="issues-title">
            <div className="panel__head">
              <h2 id="issues-title">{t('colIssues')}</h2>
            </div>
            {openAnomalies.length === 0 ? (
              <p className="panel__body muted">{t('noIssues')}</p>
            ) : (
              <ul className="evidence">
                {openAnomalies.map((a) => (
                  <li key={a.id}>
                    <Pill tone="late">{t(`anomalies.${a.kind}`)}</Pill>
                    {a.workDate && <bdi className="muted">{fmtShortDate(a.workDate, locale)}</bdi>}
                    <span className="when">
                      <ResolveButton anomalyId={a.id} label={to('check')} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel m-enter" aria-labelledby="evidence-title">
            <div className="panel__head">
              <h2 id="evidence-title">{t('evidence')}</h2>
            </div>
            <p className="panel__body t-caption muted">{t('evidenceNote')}</p>
            <ul className="evidence">
              {d.events.map((ev) => (
                <li key={ev.id}>
                  <b>{eventLabel[ev.type]}</b>
                  <span className="muted">{t(`source.${ev.source as 'web'}`)}</span>
                  {ev.insideGeofence === false && <Pill tone="late">{ts('outside')}</Pill>}
                  <span className="when">
                    <bdi>{`${fmtShortDate(localDate(ev.occurredAt, tz), locale)} ${fmtTime(ev.occurredAt, tz)}`}</bdi>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </AppFrame>
  );
}
