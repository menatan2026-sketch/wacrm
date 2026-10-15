import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/AuthShell';
import { SignupForm } from './SignupForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('createOrg') };
}

export default async function SignupPage() {
  const t = await getTranslations('auth');
  return (
    <AuthShell>
      <div>
        <h1 className="t-h1">{t('signUpTitle')}</h1>
        <p style={{ color: 'var(--ink-muted)', marginBlockStart: 'var(--space-1)' }}>{t('signUpSubtitle')}</p>
      </div>
      <SignupForm />
      <p style={{ color: 'var(--ink-muted)' }}>
        {t('haveAccount')}{' '}
        <Link href="/login" className="rt-btn rt-btn--link">
          {t('signIn')}
        </Link>
      </p>
    </AuthShell>
  );
}
