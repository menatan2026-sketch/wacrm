'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Button, Field } from '@ritmo/ui';
import { signIn, type FormState } from '@/server/auth-actions';

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} noValidate>
      {state.error && <Banner tone="danger">{t(state.error as 'invalid')}</Banner>}
      <input type="hidden" name="next" value={next ?? ''} />
      <Field label={t('email')} name="email" type="email" autoComplete="email" required defaultValue={state.fields?.email} dir="ltr" />
      <Field label={t('password')} name="password" type="password" autoComplete="current-password" required dir="ltr" />
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? t('signingIn') : t('signIn')}
      </Button>
    </form>
  );
}

export function DemoLogin({ email, label }: { email: string; label: string }) {
  const [, action, pending] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="password" value="ritmo-demo" />
      <Button type="submit" variant="secondary" size="sm" disabled={pending} style={{ inlineSize: '100%', justifyContent: 'flex-start' }}>
        {label}
      </Button>
    </form>
  );
}
