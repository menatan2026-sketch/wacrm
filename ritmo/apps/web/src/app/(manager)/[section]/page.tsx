import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { EmptyState, buttonClass } from '@ritmo/ui';
import { AppFrame } from '@/components/AppFrame';
import { requireManager } from '@/server/context';

// Screens still being built in this first version. Each gets its own route as it lands.
const SECTIONS = ['chat', 'people', 'settings'] as const;
type Section = (typeof SECTIONS)[number];
const isSection = (s: string): s is Section => (SECTIONS as readonly string[]).includes(s);

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  if (!isSection(section)) return {};
  return { title: (await getTranslations('nav'))(section) };
}

export default async function SoonPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSection(section)) notFound();
  const ctx = await requireManager();
  const tn = await getTranslations('nav');
  const t = await getTranslations('soon');
  return (
    <AppFrame ctx={ctx} crumb={tn(section)}>
      <div className="head m-enter">
        <h1 className="t-h1">{tn(section)}</h1>
      </div>
      <EmptyState
        title={t('title')}
        action={<Link className={buttonClass('secondary')} href="/overview">{t('back')}</Link>}
      >
        {t('body')}
      </EmptyState>
    </AppFrame>
  );
}
