'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/Icon';

const TABS: { href: string; key: 'today' | 'shifts' | 'chat' | 'me'; icon: IconName }[] = [
  { href: '/me', key: 'today', icon: 'home' },
  { href: '/me/shifts', key: 'shifts', icon: 'calendar' },
  { href: '/chat', key: 'chat', icon: 'chat' },
  { href: '/me/profile', key: 'me', icon: 'user' },
];

export function MeTabs({ labels }: { labels: Record<'today' | 'shifts' | 'chat' | 'me', string> }) {
  const path = usePathname();
  const active = (href: string) =>
    href === '/me' ? path === '/me' : href === '/me/profile' ? path.startsWith('/me/profile') || path.startsWith('/me/collected') : path.startsWith(href);
  return (
    <nav className="tabs mapp__tabs" aria-label={labels.today}>
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className={active(tab.href) ? 'on' : undefined} aria-current={active(tab.href) ? 'page' : undefined}>
          <Icon name={tab.icon} size={24} />
          {labels[tab.key]}
        </Link>
      ))}
    </nav>
  );
}
