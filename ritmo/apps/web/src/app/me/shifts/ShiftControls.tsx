'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Pill, useToast } from '@ritmo/ui';
import { Icon } from '@/components/Icon';
import { cancelRequest, claimShift, requestSwap, type MeError } from '../actions';

function useMeErrors() {
  const t = useTranslations('me');
  return (e: MeError) => (e === 'alreadyRequested' ? t('alreadyRequested') : e === 'tooLate' ? t('tooLate') : t('error'));
}

export function SwapControl({
  shiftId,
  colleagues,
  request,
  canRequest,
}: {
  shiftId: string;
  colleagues: { id: string; name: string }[];
  request: { id: string; target: string | null } | null;
  canRequest: boolean;
}) {
  const t = useTranslations('me');
  const router = useRouter();
  const toast = useToast();
  const errorText = useMeErrors();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [pending, start] = useTransition();

  if (request) {
    return (
      <div className="mshift__actions">
        <Pill tone="pending">{request.target ? t('swapTo', { name: request.target }) : t('pendingApproval')}</Pill>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await cancelRequest(request.id);
              toast.show(res.ok ? t('requestCancelled') : errorText(res.error));
              router.refresh();
            })
          }
        >
          {t('cancelRequest')}
        </Button>
      </div>
    );
  }
  if (!canRequest) return null;
  if (!open) {
    return (
      <div className="mshift__actions">
        <Button onClick={() => setOpen(true)}>
          <Icon name="swap" />
          {t('requestSwap')}
        </Button>
      </div>
    );
  }
  if (colleagues.length === 0) return <p className="muted">{t('noColleagues')}</p>;
  const selectId = `swap-${shiftId}`;
  return (
    <form
      className="swap-pick"
      onSubmit={(e) => {
        e.preventDefault();
        if (!target) return;
        start(async () => {
          const res = await requestSwap(shiftId, target);
          toast.show(res.ok ? t('swapSent') : errorText(res.error));
          if (res.ok) setOpen(false);
          router.refresh();
        });
      }}
    >
      <div className="rt-field">
        <label className="rt-field__label" htmlFor={selectId}>
          {t('swapWith')}
        </label>
        <select id={selectId} className="rt-input" value={target} onChange={(e) => setTarget(e.target.value)} required>
          <option value="" disabled>
            …
          </option>
          {colleagues.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="primary" disabled={pending || !target}>
        {t('send')}
      </Button>
      <Button variant="ghost" icon aria-label={t('cancelRequest')} onClick={() => setOpen(false)}>
        <Icon name="close" />
      </Button>
    </form>
  );
}

export function ClaimButton({ shiftId, requestId }: { shiftId: string; requestId: string | null }) {
  const t = useTranslations('me');
  const router = useRouter();
  const toast = useToast();
  const errorText = useMeErrors();
  const [pending, start] = useTransition();
  if (requestId) {
    return (
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await cancelRequest(requestId);
            toast.show(res.ok ? t('requestCancelled') : errorText(res.error));
            router.refresh();
          })
        }
      >
        {t('claimPending')} · {t('cancelRequest')}
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="primary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await claimShift(shiftId);
          toast.show(res.ok ? t('claimed') : errorText(res.error));
          router.refresh();
        })
      }
    >
      {t('claim')}
    </Button>
  );
}
