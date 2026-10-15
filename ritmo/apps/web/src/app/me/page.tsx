import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@ritmo/ui';
import { AppFrame } from '@/components/AppFrame';
import { requireCtx } from '@/server/context';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('nav'))('myApp') };
}

export default async function MePage() {
  const ctx = await requireCtx();
  const tn = await getTranslations('nav');
  const t = await getTranslations('soon');
  return (
    <AppFrame ctx={ctx} crumb={tn('myApp')}>
      <div className="head m-enter">
        <h1 className="t-h1">{tn('myApp')}</h1>
      </div>
      <EmptyState title={t('title')}>{t('body')}</EmptyState>
    </AppFrame>
  );
}
