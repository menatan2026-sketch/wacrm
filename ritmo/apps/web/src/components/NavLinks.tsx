'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from './Icon';

interface Item {
  href: string;
  label: string;
  icon: IconName;
  badge?: React.ReactNode;
}

export function NavLinks({ items, group, groupItems }: { items: Item[]; group: string; groupItems: Item[] }) {
  const path = usePathname();
  const link = (i: Item) => {
    const active = path === i.href || path.startsWith(`${i.href}/`);
    return (
      <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}>
        <Icon name={i.icon} />
        {i.label}
        {i.badge}
      </Link>
    );
  };
  return (
    <nav className="nav">
      {items.map(link)}
      <div className="nav__group">{group}</div>
      {groupItems.map(link)}
    </nav>
  );
}

/** Opens the sidebar as a drawer on narrow screens; Esc or navigation closes it. */
export function SideToggle({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.getElementById('sidebar')?.classList.toggle('is-open', open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <button
      type="button"
      className="rt-btn rt-btn--ghost rt-btn--icon rt-btn--sm menu-btn"
      aria-label={label}
      aria-expanded={open}
      aria-controls="sidebar"
      onClick={() => setOpen((o) => !o)}
    >
      <Icon name="menu" />
    </button>
  );
}
