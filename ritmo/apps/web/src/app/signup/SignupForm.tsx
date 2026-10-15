'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Button, Field } from '@ritmo/ui';
import { signUp, type FormState } from '@/server/auth-actions';

export function SignupForm() {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {});
  const f = state.fields ?? {};
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} noValidate>
      {state.error && <Banner tone="danger">{t(state.error as 'required')}</Banner>}
      <Field label={t('orgName')} hint={t('orgNameHint')} name="orgName" required defaultValue={f.orgName} autoComplete="organization" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <Field label={t('firstName')} name="firstName" required defaultValue={f.firstName} autoComplete="given-name" />
        <Field label={t('lastName')} name="lastName" defaultValue={f.lastName} autoComplete="family-name" />
      </div>
      <Field label={t('email')} name="email" type="email" required defaultValue={f.email} autoComplete="email" dir="ltr" />
      <Field label={t('password')} hint={t('passwordHint')} name="password" type="password" required minLength={10} autoComplete="new-password" dir="ltr" />
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {t('createAccount')}
      </Button>
    </form>
  );
}
