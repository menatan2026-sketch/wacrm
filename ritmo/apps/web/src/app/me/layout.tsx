import { getTranslations } from 'next-intl/server';
import { requireCtx } from '@/server/context';
import { MeTabs } from './MeTabs';

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  await requireCtx();
  const t = await getTranslations('me');
  return (
    <div className="mapp">
      <main id="main" className="mapp__main">
        {children}
      </main>
      <MeTabs labels={{ today: t('tabToday'), shifts: t('tabShifts'), chat: t('tabChat'), me: t('tabMe') }} />
    </div>
  );
}
