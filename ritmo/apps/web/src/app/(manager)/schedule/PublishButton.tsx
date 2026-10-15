'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button, useToast } from '@ritmo/ui';
import { publishWeek } from './actions';

export function PublishButton({ locationId, weekStart }: { locationId: string; weekStart: string }) {
  const t = useTranslations('schedule');
  const tc = useTranslations('common');
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="primary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await publishWeek(locationId, weekStart);
          if (!res.ok) toast.show(res.error === 'forbidden' ? tc('forbidden') : tc('error'));
          else if ('count' in res && res.count > 0) toast.show(t('published', { count: res.count }));
          else toast.show(t('nothingToPublish'));
        })
      }
    >
      {t('publish')}
    </Button>
  );
}
