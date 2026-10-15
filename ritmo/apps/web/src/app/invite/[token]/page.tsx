import { getTranslations } from 'next-intl/server';
import { asApp } from '@ritmo/db';
import { Banner } from '@ritmo/ui';
import { AuthShell } from '@/components/AuthShell';
import { hashToken } from '@/server/auth';
import { InviteForm } from './InviteForm';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations('auth');
  const [invite] = await asApp(
    (tx) => tx<{ org_name: string; first_name: string }[]>`select * from ritmo.invitation_preview(${hashToken(token)})`,
  );
  return (
    <AuthShell>
      {invite ? (
        <>
          <div>
            <h1 className="t-h1">{t('inviteTitle', { org: invite.org_name })}</h1>
            <p style={{ color: 'var(--ink-muted)', marginBlockStart: 'var(--space-1)' }}>{t('inviteBody', { name: invite.first_name })}</p>
          </div>
          <InviteForm token={token} />
        </>
      ) : (
        <Banner tone="warning">{t('inviteInvalid')}</Banner>
      )}
    </AuthShell>
  );
}
