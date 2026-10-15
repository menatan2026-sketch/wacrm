import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { initials } from '@ritmo/core';
import { Avatar } from '@ritmo/ui';
import { Icon } from '@/components/Icon';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { THEME_COOKIE } from '@/i18n/locale';
import { requireCtx } from '@/server/context';
import { signOut } from '@/server/auth-actions';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('me'))('profile') };
}

export default async function ProfilePage() {
  const ctx = await requireCtx();
  const t = await getTranslations('me');
  const tr = await getTranslations('roles');
  const locale = await getLocale();
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  const m = ctx.member;
  const chevron = locale === 'he' ? 'chevron' : 'chevronNext';

  return (
    <>
      <div className="ptop">
        <h1>{t('profile')}</h1>
      </div>
      <div className="mprofile">
        <Avatar initials={initials(m.firstName, m.lastName)} tint={m.avatarColor} size="lg" />
        <div>
          <b>{`${m.firstName} ${m.lastName}`.trim()}</b>
          <span>{t('roleTitle', { role: m.title ?? tr(m.role), org: m.orgName })}</span>
        </div>
      </div>

      <section className="psec" style={{ marginBlockStart: 'var(--space-5)' }}>
        <div className="plist">
          <Link href="/me/collected" className="mrow-link">
            <Icon name="shield" />
            <div className="plist__main">
              <b>{t('whatsCollected')}</b>
            </div>
            <Icon name={chevron} />
          </Link>
          {ctx.isManager && (
            <Link href="/overview" className="mrow-link">
              <Icon name="home" />
              <div className="plist__main">
                <b>{t('managerView')}</b>
              </div>
              <Icon name={chevron} />
            </Link>
          )}
        </div>
      </section>

      <section className="psec">
        <div className="psec__title">{t('language')}</div>
        <LanguageSwitch />
      </section>
      <section className="psec">
        <div className="psec__title">{t('theme')}</div>
        <ThemeSwitch current={theme === 'light' || theme === 'dark' ? theme : 'system'} />
      </section>

      <section className="psec">
        <form action={signOut}>
          <button type="submit" className="rt-btn rt-btn--secondary rt-btn--lg" style={{ inlineSize: '100%' }}>
            <Icon name="logout" />
            {t('signOut')}
          </button>
        </form>
      </section>
    </>
  );
}
