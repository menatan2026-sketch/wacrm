import { getLocale, getTranslations } from 'next-intl/server';
import { Avatar, Count, Kbd, buttonClass } from '@ritmo/ui';
import { initials } from '@ritmo/core';
import type { Ctx } from '@/server/context';
import { signOut } from '@/server/auth-actions';
import { Logo, Mark } from './Logo';
import { NavLinks, SideToggle } from './NavLinks';
import { Icon } from './Icon';

async function navCounts(ctx: Ctx) {
  return ctx.db(async (tx) => {
    const [row] = await tx<{ issues: number; unread: number }[]>`
      select
        (select count(*)::int from ritmo.anomalies a where a.org_id = ${ctx.member.orgId} and a.status = 'open'
           and a.member_id <> ${ctx.member.memberId}) as issues,
        (select count(*)::int from ritmo.messages m
           join ritmo.conversation_members cm on cm.conversation_id = m.conversation_id and cm.member_id = ${ctx.member.memberId}
           where m.org_id = ${ctx.member.orgId} and m.created_at > cm.last_read_at and m.sender_member_id <> ${ctx.member.memberId}) as unread`;
    return row ?? { issues: 0, unread: 0 };
  });
}

export async function AppFrame({ ctx, crumb, children }: { ctx: Ctx; crumb: string; children: React.ReactNode }) {
  const t = await getTranslations('nav');
  const tr = await getTranslations('roles');
  const locale = await getLocale();
  const counts = await navCounts(ctx);
  const m = ctx.member;

  const items = [
    { href: '/overview', label: t('overview'), icon: 'home' as const },
    { href: '/schedule', label: t('schedule'), icon: 'calendar' as const },
    { href: '/time', label: t('time'), icon: 'clock' as const, count: counts.issues, beat: true },
    { href: '/activity', label: t('activity'), icon: 'monitor' as const },
    { href: '/chat', label: t('chat'), icon: 'chat' as const, count: counts.unread },
  ];
  const manage = [
    { href: '/people', label: t('people'), icon: 'people' as const },
    { href: '/settings', label: t('settings'), icon: 'settings' as const },
    { href: '/me', label: t('myApp'), icon: 'phone' as const },
  ];

  return (
    <div className="frame">
      <aside className="side" id="sidebar" aria-label={t('overview')}>
        <div className="ws">
          <Logo locale={locale} height={24} />
        </div>
        <div className="ws-name">
          <span className="rt-avatar rt-avatar--sun" style={{ inlineSize: 20, blockSize: 20, fontSize: 10, borderRadius: 5 }} aria-hidden="true">
            {m.orgName.slice(0, 2)}
          </span>
          <b>{m.orgName}</b>
          {m.isDemo && <span className="rt-pill rt-pill--plain">{t('demoBadge')}</span>}
        </div>
        <NavLinks
          items={items.map((i) => ({ ...i, badge: i.count ? <Count beat={i.beat}>{i.count}</Count> : null }))}
          group={t('manage')}
          groupItems={manage}
        />
        <div className="side__foot">
          <Avatar initials={initials(m.firstName, m.lastName)} tint={m.avatarColor} />
          <div className="grow">
            {m.firstName} {m.lastName}
            <span>{m.title ?? tr(m.role)}</span>
          </div>
          <form action={signOut}>
            <button type="submit" className={buttonClass('ghost', 'sm', true)} aria-label={t('signOut')} title={t('signOut')}>
              <Icon name="logout" />
            </button>
          </form>
        </div>
      </aside>
      <div className="sheet">
        <header className="bar">
          <SideToggle label={t('overview')} />
          <div className="crumbs">
            {m.orgName} <Icon name="chevron" className="rtl-flip" /> <b>{crumb}</b>
          </div>
          <div className="bar__sp" />
          <form className="search" action="/people" role="search">
            <Icon name="search" />
            <label htmlFor="global-search" className="sr-only">{t('search')}</label>
            <input
              id="global-search"
              name="q"
              placeholder={t('search')}
              style={{ border: 0, background: 'transparent', outline: 'none', color: 'var(--ink)', font: 'inherit', inlineSize: '100%' }}
            />
            <Kbd>⌘K</Kbd>
          </form>
          <button type="button" className={buttonClass('secondary', 'sm')} disabled title={t('askRitmoSoon')}>
            <Mark size={16} />
            {t('askRitmo')}
          </button>
        </header>
        <main id="main" className="content">
          {children}
        </main>
      </div>
    </div>
  );
}
