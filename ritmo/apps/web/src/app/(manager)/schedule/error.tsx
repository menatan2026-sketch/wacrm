'use client';

import { useTranslations } from 'next-intl';
import { Banner, Button } from '@ritmo/ui';

export default function ScheduleError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('schedule');
  const tc = useTranslations('common');
  return (
    <div className="content">
      <Banner tone="danger" actions={<Button size="sm" onClick={reset}>{tc('retry')}</Button>}>
        <b>{t('loadError')}</b> {tc('error')}
      </Banner>
    </div>
  );
}
