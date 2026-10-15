import { getLocale } from 'next-intl/server';
import { Logo } from './Logo';

export async function AuthShell({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <main id="main" style={{ minBlockSize: '100dvh', display: 'grid', placeItems: 'center', padding: 'var(--space-6) var(--space-4)' }}>
      <div style={{ inlineSize: '100%', maxInlineSize: 420, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Logo locale={locale} height={28} />
        </div>
        <section className="m-enter" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {children}
        </section>
        {aside}
      </div>
    </main>
  );
}
