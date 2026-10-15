import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { Banner, EmptyState } from '@ritmo/ui';
import { AppFrame } from '@/components/AppFrame';
import { Icon } from '@/components/Icon';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { THEME_COOKIE } from '@/i18n/locale';
import { requireManager } from '@/server/context';
import { locations } from '@/server/queries';
import { auditLog } from '@/server/people-queries';
import { fmtDuration, fmtTime, fmtShortDate, iso } from '@/lib/format';
import { localDate } from '@ritmo/core';
import { LocationRow, OrgForm, ProfileForm } from './SettingsForms';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('settings'))('title') };
}

export default async function SettingsPage() {
  const ctx = await requireManager();
  const t = await getTranslations('settings');
  const locale = await getLocale();
  const tz = ctx.member.timezone;
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  const isAdmin = ctx.member.role === 'owner' || ctx.member.role === 'admin';
  const [locs, audit, profile] = await Promise.all([
    locations(ctx),
    isAdmin ? auditLog(ctx) : Promise.resolve([]),
    ctx.db((tx) => tx<{ phone: string | null }[]>`select phone from ritmo.members where id = ${ctx.member.memberId}`),
  ]);
  const p = ctx.member.policy;
  const pct = (r: number) => iso(`${Math.round(r * 100)}%`);
  const weekday = new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, 0, 4 + p.restDay)),
  );
  const actionLabel = (a: string) => {
    const key = `actions.${a.replace(/\./g, '_')}`;
    return t.has(key as 'actions.member_create') ? t(key as 'actions.member_create') : a;
  };
  const policy: [string, string][] = [
    [t('policyDaily'), fmtDuration(p.dailyRegularMinutes)],
    [t('policyWeekly'), fmtDuration(p.weeklyRegularMinutes)],
    [t('policyTier1'), `${fmtDuration(p.firstTierMinutes)} · ${pct(p.firstTierRate)}`],
    [t('policyTier2'), pct(p.secondTierRate)],
    [t('policyRest'), `${weekday} · ${pct(p.restDayRate)}`],
    [t('policyGrace'), t('minutes', { minutes: p.lateGraceMinutes })],
    [t('policyBreak'), fmtDuration(p.breakRequiredAfterMinutes)],
    [t('policyGeofence'), t(`geofence.${p.geofenceMode}`)],
  ];

  return (
    <AppFrame ctx={ctx} crumb={t('title')}>
      <div className="head m-enter">
        <div>
          <h1 className="t-h1">{t('title')}</h1>
          <p className="head__sub">{ctx.member.orgName}</p>
        </div>
      </div>
      {ctx.member.isDemo && (
        <div style={{ marginBlockEnd: 'var(--space-5)' }}>
          <Banner tone="info" icon={<Icon name="alert" />}>{t('demoNote')}</Banner>
        </div>
      )}

      <div className="settings-grid">
        <section className="panel m-enter" aria-labelledby="s-profile">
          <div className="panel__head"><h2 id="s-profile">{t('profile')}</h2></div>
          <div className="panel__body">
            <ProfileForm firstName={ctx.member.firstName} lastName={ctx.member.lastName} phone={profile[0]?.phone ?? ''} />
          </div>
        </section>

        <section className="panel m-enter" aria-labelledby="s-look">
          <div className="panel__head"><h2 id="s-look">{t('language')} · {t('theme')}</h2></div>
          <div className="panel__body stack">
            <span className="rt-field__label">{t('language')}</span>
            <LanguageSwitch />
            <span className="rt-field__label">{t('theme')}</span>
            <ThemeSwitch current={theme === 'light' || theme === 'dark' ? theme : 'system'} />
          </div>
        </section>

        <section className="panel m-enter" aria-labelledby="s-org">
          <div className="panel__head"><h2 id="s-org">{t('org')}</h2></div>
          <div className="panel__body">
            <OrgForm name={ctx.member.orgName} canEdit={isAdmin} />
          </div>
        </section>

        <section className="panel m-enter" aria-labelledby="s-policy">
          <div className="panel__head"><h2 id="s-policy">{t('policy')}</h2></div>
          <dl className="policy-list">
            {policy.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd><bdi>{v}</bdi></dd>
              </div>
            ))}
          </dl>
          <p className="policy-note">{t('policyBody')}</p>
        </section>
      </div>

      <section className="panel m-enter" aria-labelledby="s-locs" style={{ marginBlockStart: 'var(--space-5)' }}>
        <div className="panel__head">
          <h2 id="s-locs">{t('locations')}</h2>
          {!isAdmin && <span className="t-caption muted" style={{ marginInlineStart: 'auto' }}>{t('adminOnly')}</span>}
        </div>
        <div className="loc-rows">
          {locs.map((l) => (
            <LocationRow
              key={l.id}
              id={l.id}
              name={l.name}
              budget={l.weekly_budget_minor !== null ? String(Number(l.weekly_budget_minor) / 100) : ''}
              radius={l.geofence_radius_m}
              canEdit={isAdmin}
            />
          ))}
        </div>
      </section>

      {isAdmin && (
        <section className="panel m-enter" aria-labelledby="s-audit" style={{ marginBlockStart: 'var(--space-5)' }}>
          <div className="panel__head"><h2 id="s-audit">{t('auditLog')}</h2></div>
          {audit.length === 0 ? (
            <EmptyState title={t('auditEmpty')} />
          ) : (
            <div className="table-wrap">
              <table className="rt-table">
                <thead>
                  <tr>
                    <th scope="col">{t('colWhen')}</th>
                    <th scope="col">{t('colWho')}</th>
                    <th scope="col">{t('colAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="muted"><bdi>{`${fmtShortDate(localDate(a.created_at, tz), locale)} ${fmtTime(a.created_at, tz)}`}</bdi></td>
                      <td>{a.actor ?? t('system')}</td>
                      <td>
                        {actionLabel(a.action)}
                        {typeof a.details.reason === 'string' && <span className="muted"> · {a.details.reason}</span>}
                        {typeof a.details.note === 'string' && <span className="muted"> · {a.details.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </AppFrame>
  );
}
