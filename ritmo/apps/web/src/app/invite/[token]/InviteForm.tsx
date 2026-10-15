'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Banner, Button, Field } from '@ritmo/ui';
import { acceptInvite, type FormState } from '@/server/auth-actions';

export function InviteForm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState<FormState, FormData>(acceptInvite, {});
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {state.error && <Banner tone="danger">{t(state.error as 'tooShort')}</Banner>}
      <input type="hidden" name="token" value={token} />
      <Field label={t('password')} hint={t('passwordHint')} name="password" type="password" required minLength={10} autoComplete="new-password" dir="ltr" />
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {t('join')}
      </Button>
    </form>
  );
}
