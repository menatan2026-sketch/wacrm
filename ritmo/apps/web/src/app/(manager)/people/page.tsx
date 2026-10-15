import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { initials } from '@ritmo/core';
import { Avatar, EmptyState, Status, type Tint } from '@ritmo/ui';
import { AppFrame } from '@/components/AppFrame';
import { Icon } from '@/components/Icon';
import { requireManager } from '@/server/context';
import { locations } from '@/server/queries';
import { people, positions } from '@/server/people-queries';
import { InviteButton, MemberDialog, type FormOptions, type MemberFormValues } from './PeopleControls';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('people'))('title') };
}

const ROLES_I_CAN_GRANT = {
  owner: ['employee', 'manager', 'admin', 'owner'],
  admin: ['employee', 'manager'],
  manager: ['employee'],
  employee: [],
} as const;

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string; loc?: string }> }) {
  const ctx = await requireManager();
  const t = await getTranslations('people');
  const tr = await getTranslations('roles');
  const { q, loc } = await searchParams;
  const query = q?.trim().slice(0, 60) || null;
  const [locs, pos] = await Promise.all([locations(ctx), positions(ctx)]);
  const current = locs.find((l) => l.id === loc) ?? null;
  const rows = await people(ctx, query, current?.id ?? null);

  const options: FormOptions = {
    positions: pos,
    locations: locs.map((l) => ({ id: l.id, name: l.name })),
    roles: [...ROLES_I_CAN_GRANT[ctx.member.role]],
  };
  const blank: MemberFormValues = {
    firstName: '', lastName: '', email: '', phone: '', positionId: '', locationId: current?.id ?? locs[0]?.id ?? '',
    role: 'employee', rate: '', contractHours: '', worksOn: 'site',
  };
  const href = (l: string | null) => `/people?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(l ? { loc: l } : {}) })}`;

  return (
    <AppFrame ctx={ctx} crumb={t('title')}>
      <div className="head m-enter">
        <div>
          <h1 className="t-h1">{t('title')}</h1>
          <p className="head__sub">{t('subtitle', { count: rows.length })}</p>
        </div>
        <div className="head__actions">
          <form action="/people" role="search" className="people-search">
            {current && <input type="hidden" name="loc" value={current.id} />}
            <label className="sr-only" htmlFor="people-q">{t('searchPlaceholder')}</label>
            <input id="people-q" className="rt-input" name="q" type="search" defaultValue={query ?? ''} placeholder={t('searchPlaceholder')} />
          </form>
          <nav className="rt-seg" aria-label={t('colBranch')}>
            <Link href={href(null)} aria-current={!current ? 'page' : undefined}>{t('allBranches')}</Link>
            {locs.map((l) => (
              <Link key={l.id} href={href(l.id)} aria-current={current?.id === l.id ? 'page' : undefined}>{l.name}</Link>
            ))}
          </nav>
          <MemberDialog trigger="add" initial={blank} options={options} />
        </div>
      </div>

      <section className="panel m-enter" aria-labelledby="people-title">
        <div className="panel__head">
          <h2 id="people-title">{current?.name ?? t('allBranches')}</h2>
        </div>
        {rows.length === 0 ? (
          <EmptyState title={t('noResults')} />
        ) : (
          <div className="table-wrap">
            <table className="rt-table">
              <thead>
                <tr>
                  <th scope="col">{t('colPerson')}</th>
                  <th scope="col">{t('colPosition')}</th>
                  <th scope="col">{t('colBranch')}</th>
                  <th scope="col">{t('colAccess')}</th>
                  <th scope="col">{t('colPhone')}</th>
                  <th scope="col">{t('colStatus')}</th>
                  <th scope="col"><span className="sr-only">{t('actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const name = `${r.first_name} ${r.last_name}`.trim();
                  const values: MemberFormValues = {
                    id: r.id, firstName: r.first_name, lastName: r.last_name, email: r.email ?? '', phone: r.phone ?? '',
                    positionId: r.position_id ?? '', locationId: r.primary_location_id ?? r.location_ids?.[0] ?? '', role: r.role,
                    rate: r.rate_minor !== null ? String(Number(r.rate_minor) / 100) : '', contractHours: r.contract_hours_week ?? '',
                    worksOn: r.works_on,
                  };
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="rt-person">
                          <Avatar initials={initials(r.first_name, r.last_name)} tint={r.avatar_color as Tint} />
                          <div>
                            <b>{name}</b>
                            {r.email && <div className="t-caption muted"><bdi>{r.email}</bdi></div>}
                          </div>
                        </div>
                      </td>
                      <td className="muted">{r.title ?? r.position_name ?? '—'}</td>
                      <td className="muted">{(r.locations ?? []).join(', ') || '—'}</td>
                      <td>{tr(r.role)}</td>
                      <td>{r.phone ? <bdi dir="ltr">{r.phone}</bdi> : <span className="muted">—</span>}</td>
                      <td>
                        {r.has_login ? (
                          <Status tone="on">{t('hasLogin')}</Status>
                        ) : r.invited ? (
                          <Status tone="pending">{t('invited')}</Status>
                        ) : (
                          <Status tone="off">{t('noLogin')}</Status>
                        )}
                      </td>
                      <td>
                        {r.can_manage && (
                          <div className="row-actions">
                            {!r.has_login && <InviteButton memberId={r.id} name={name} />}
                            <MemberDialog trigger="edit" initial={values} options={options} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {ctx.member.role === 'manager' && (
        <p className="t-caption muted" style={{ marginBlockStart: 'var(--space-3)' }}>
          <Icon name="alert" size={14} /> {t('managersOnlyEmployees')}
        </p>
      )}
    </AppFrame>
  );
}
