import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/AuthShell';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { DemoLogin, LoginForm } from './LoginForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('signIn') };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const t = await getTranslations('auth');
  const showDemo = process.env.RITMO_SHOW_DEMO !== '0';
  return (
    <AuthShell
      aside={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {showDemo && (
            <section aria-labelledby="demo-title" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <h2 id="demo-title" className="t-h3">{t('demoTitle')}</h2>
              <p className="t-caption" style={{ color: 'var(--ink-muted)' }}>{t('demoBody')}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--space-2)' }}>
                <DemoLogin email="michal@cafe-alma.test" label={t('demoOwner')} />
                <DemoLogin email="omer@cafe-alma.test" label={t('demoManager')} />
                <DemoLogin email="dana@cafe-alma.test" label={t('demoEmployee')} />
                <DemoLogin email="shiran@cafe-alma.test" label={t('demoComputer')} />
              </div>
            </section>
          )}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <LanguageSwitch />
          </div>
        </div>
      }
    >
      <div>
        <h1 className="t-h1">{t('signInTitle')}</h1>
        <p style={{ color: 'var(--ink-muted)', marginBlockStart: 'var(--space-1)' }}>{t('signInSubtitle')}</p>
      </div>
      <LoginForm next={next} />
      <p className="t-body" style={{ color: 'var(--ink-muted)' }}>
        {t('noAccount')}{' '}
        <Link href="/signup" className="rt-btn rt-btn--link">
          {t('createOrg')}
        </Link>
      </p>
    </AuthShell>
  );
}
