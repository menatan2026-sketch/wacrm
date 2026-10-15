import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { addDays, initials, weekNumber } from '@ritmo/core';
import { Avatar, EmptyState, Num, Pill, Stat, Stats, Status, buttonClass, type Tint } from '@ritmo/ui';
import { AppFrame } from '@/components/AppFrame';
import { Icon } from '@/components/Icon';
import { requireManager } from '@/server/context';
import { locations } from '@/server/queries';
import { parseWeek, weekSheet } from '@/server/time-queries';
import { fmtDuration, fmtRange } from '@/lib/format';
import { ApproveAllButton, ApproveButton } from './TimeControls';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('time'))('title') };
}

export default async function TimePage({ searchParams }: { searchParams: Promise<{ week?: string; loc?: string }> }) {
  const ctx = await requireManager();
  const t = await getTranslations('time');
  const tc = await getTranslations('common');
  const ts = await getTranslations('status');
  const locale = await getLocale();
  const { week, loc } = await searchParams;
  const ws = parseWeek(week);
  const locs = (await locations(ctx)).filter((l) => l.kind === 'branch' || l.kind === 'office');
  const current = locs.find((l) => l.id === loc) ?? null;
  const rows = await weekSheet(ctx, ws, current?.id ?? null);

  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const hours = sum((r) => r.totals.total);
  const overtime = sum((r) => r.totals.overtime1 + r.totals.overtime2);
  const issues = sum((r) => r.openIssues);
  const pending = rows.filter((r) => r.approval === 'waiting').length;
  const clean = rows.filter((r) => r.approval === 'waiting' && r.openIssues === 0 && !r.running && !r.isSelf).length;
  const q = (w: string, l: string | null) => `/time?week=${w}${l ? `&loc=${l}` : ''}`;
  const exportHref = `/api/export/payroll?week=${ws}${current ? `&loc=${current.id}` : ''}`;
  const prevIcon = locale === 'he' ? 'chevronNext' : 'chevron';
  const nextIcon = locale === 'he' ? 'chevron' : 'chevronNext';

  return (
    <AppFrame ctx={ctx} crumb={t('title')}>
      <div className="head m-enter">
        <div>
          <h1 className="t-h1">{t('title')}</h1>
          <p className="head__sub">
            {tc('week', { number: weekNumber(ws) })} · <bdi>{fmtRange(ws, addDays(ws, 6), locale)}</bdi> · {current?.name ?? tc('allLocations')}
          </p>
        </div>
        <div className="head__actions">
          <nav className="rt-seg" aria-label={tc('allLocations')}>
            <Link href={q(ws, null)} aria-current={!current ? 'page' : undefined}>
              {tc('allLocations')}
            </Link>
            {locs.map((l) => (
              <Link key={l.id} href={q(ws, l.id)} aria-current={current?.id === l.id ? 'page' : undefined}>
                {l.name}
              </Link>
            ))}
          </nav>
          <div className="weeknav">
            <Link className={buttonClass('ghost', 'md', true)} href={q(addDays(ws, -7), current?.id ?? null)} aria-label={tc('previousWeek')}>
              <Icon name={prevIcon} />
            </Link>
            <Link className={buttonClass('ghost', 'sm')} href={q(parseWeek(), current?.id ?? null)}>
              {tc('today')}
            </Link>
            <Link className={buttonClass('ghost', 'md', true)} href={q(addDays(ws, 7), current?.id ?? null)} aria-label={tc('nextWeek')}>
              <Icon name={nextIcon} />
            </Link>
          </div>
          <a className={buttonClass('secondary')} href={exportHref}>
            <Icon name="download" size={16} />
            {t('export')}
          </a>
          <ApproveAllButton week={ws} locationId={current?.id ?? null} disabled={clean === 0} />
        </div>
      </div>

      <Stats label={t('statsLabel')}>
        <Stat label={t('hours')} value={<Num>{fmtDuration(hours)}</Num>} />
        <Stat label={t('overtime')} value={<Num>{fmtDuration(overtime)}</Num>} />
        <Stat label={t('openIssues')} value={<Num>{issues}</Num>} />
        <Stat label={t('pending')} value={<Num>{pending}</Num>} />
      </Stats>

      <section className="panel m-enter" aria-labelledby="sheet-title">
        <div className="panel__head">
          <h2 id="sheet-title">{t('weekOf', { range: fmtRange(ws, addDays(ws, 6), locale) })}</h2>
        </div>
        {rows.length === 0 ? (
          <EmptyState title={t('noEntries')}>{t('noEntriesBody')}</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="rt-table">
              <thead>
                <tr>
                  <th scope="col">{t('colPerson')}</th>
                  <th scope="col">{t('colBranch')}</th>
                  <th scope="col" className="num">{t('colRegular')}</th>
                  <th scope="col" className="num">{t('colOt1')}</th>
                  <th scope="col" className="num">{t('colOt2')}</th>
                  <th scope="col" className="num">{t('colRest')}</th>
                  <th scope="col" className="num">{t('colTotal')}</th>
                  <th scope="col">{t('colIssues')}</th>
                  <th scope="col">{t('colStatus')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('approve')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="m-stagger">
                {rows.map((r) => (
                  <tr key={r.memberId}>
                    <td>
                      <div className="rt-person">
                        <Avatar initials={initials(r.firstName, r.lastName)} tint={r.avatarColor as Tint} />
                        <Link href={`/time/${r.memberId}?week=${ws}`}>
                          <b>{`${r.firstName} ${r.lastName}`.trim()}</b>
                        </Link>
                      </div>
                    </td>
                    <td className="muted">{r.location}</td>
                    <td className="num"><Num>{fmtDuration(r.totals.regular)}</Num></td>
                    <td className="num"><Num>{fmtDuration(r.totals.overtime1)}</Num></td>
                    <td className="num"><Num>{fmtDuration(r.totals.overtime2)}</Num></td>
                    <td className="num"><Num>{fmtDuration(r.totals.restDay)}</Num></td>
                    <td className="num"><b><Num>{fmtDuration(r.totals.total)}</Num></b></td>
                    <td>{r.openIssues > 0 ? <Pill tone="late">{t('issues', { count: r.openIssues })}</Pill> : <span className="muted">{t('noIssues')}</span>}</td>
                    <td>
                      {r.running ? (
                        <Status tone="on">{t('running')}</Status>
                      ) : r.approval === 'approved' ? (
                        <Status tone="on">{ts('approved')}</Status>
                      ) : (
                        <Status tone="pending">{ts('waiting')}</Status>
                      )}
                    </td>
                    <td>
                      {r.approval === 'waiting' && !r.isSelf && !r.running && <ApproveButton memberId={r.memberId} week={ws} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="policy-note">{t('policyNote')}</p>
      </section>
    </AppFrame>
  );
}
