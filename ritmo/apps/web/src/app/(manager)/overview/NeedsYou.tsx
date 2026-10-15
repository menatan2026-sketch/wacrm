'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button, useToast } from '@ritmo/ui';
import { Icon } from '@/components/Icon';
import { decideRequest, resolveAnomaly } from '../actions';

/** Inline approve: the row slides toward inline-end and fades (motion.css m-dismiss). */
function useDismiss() {
  const [leaving, setLeaving] = useState(false);
  return { leaving, className: leaving ? 'm-dismiss' : undefined, leave: () => setLeaving(true) };
}

export function RequestItem({ id, title, detail }: { id: string; title: string; detail: React.ReactNode }) {
  const t = useTranslations('overview');
  const tc = useTranslations('common');
  const toast = useToast();
  const [pending, start] = useTransition();
  const d = useDismiss();
  const run = (approve: boolean) =>
    start(async () => {
      const res = await decideRequest(id, approve);
      if (res.ok) {
        d.leave();
        toast.show(approve ? t('approved') : t('declined'));
      } else toast.show(res.error === 'forbidden' ? tc('forbidden') : tc('error'));
    });
  return (
    <li className={d.className}>
      <span className="todo__ic warn"><Icon name="swap" /></span>
      <div className="todo__main">
        <b>{title}</b>
        <span>{detail}</span>
        <div className="todo__act">
          <Button variant="primary" size="sm" disabled={pending} onClick={() => run(true)}>
            <Icon name="check" size={16} />
            {t('approve')}
          </Button>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(false)}>
            {t('decline')}
          </Button>
        </div>
      </div>
    </li>
  );
}

export function GeofenceItem({ id, title, detail }: { id: string; title: string; detail: React.ReactNode }) {
  const t = useTranslations('overview');
  const tc = useTranslations('common');
  const toast = useToast();
  const [pending, start] = useTransition();
  const d = useDismiss();
  return (
    <li className={d.className}>
      <span className="todo__ic danger"><Icon name="pin" /></span>
      <div className="todo__main">
        <b>{title}</b>
        <span>{detail}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await resolveAnomaly(id);
            if (res.ok) {
              d.leave();
              toast.show(t('resolved'));
            } else toast.show(tc('error'));
          })
        }
      >
        {t('check')}
      </Button>
    </li>
  );
}
