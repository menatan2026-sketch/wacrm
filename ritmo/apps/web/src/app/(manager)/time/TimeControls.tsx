'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Field, useToast } from '@ritmo/ui';
import { Icon } from '@/components/Icon';
import { resolveAnomaly } from '../actions';
import { approveAllClean, approveWeek, editEntry } from './actions';

function useErrorText() {
  const t = useTranslations('time');
  const tc = useTranslations('common');
  return (e: string) =>
    e === 'self' ? t('selfApprove') : e === 'forbidden' ? tc('forbidden') : e === 'reasonRequired' ? t('reasonRequired') : tc('error');
}

export function ApproveButton({ memberId, week, disabled }: { memberId: string; week: string; disabled?: boolean }) {
  const t = useTranslations('time');
  const toast = useToast();
  const router = useRouter();
  const errorText = useErrorText();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending || disabled}
      onClick={() =>
        start(async () => {
          const res = await approveWeek(memberId, week);
          toast.show(res.ok ? t('approvedCount', { count: 1 }) : errorText(res.error));
          router.refresh();
        })
      }
    >
      <Icon name="check" size={16} />
      {t('approve')}
    </Button>
  );
}

export function ApproveAllButton({ week, locationId, disabled }: { week: string; locationId: string | null; disabled?: boolean }) {
  const t = useTranslations('time');
  const toast = useToast();
  const router = useRouter();
  const errorText = useErrorText();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="primary"
      disabled={pending || disabled}
      onClick={() =>
        start(async () => {
          const res = await approveAllClean(week, locationId);
          toast.show(res.ok ? t('approvedCount', { count: res.count }) : errorText(res.error));
          router.refresh();
        })
      }
    >
      <Icon name="check" size={16} />
      {t('approveAll')}
    </Button>
  );
}

export function ResolveButton({ anomalyId, label }: { anomalyId: string; label: string }) {
  const tc = useTranslations('common');
  const to = useTranslations('overview');
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await resolveAnomaly(anomalyId);
          toast.show(res.ok ? to('resolved') : tc('error'));
          router.refresh();
        })
      }
    >
      {label}
    </Button>
  );
}

export interface EditableEntry {
  id: string;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
}

export function EditEntryButton({ entry }: { entry: EditableEntry }) {
  const t = useTranslations('time');
  const tc = useTranslations('common');
  const toast = useToast();
  const router = useRouter();
  const errorText = useErrorText();
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const titleId = `edit-${entry.id}`;

  return (
    <>
      <Button size="sm" variant="ghost" icon aria-label={`${t('editEntry')} ${entry.date}`} onClick={() => ref.current?.showModal()}>
        <Icon name="edit" size={16} />
      </Button>
      <dialog ref={ref} className="dialog" aria-labelledby={titleId} onClose={() => setError(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () => {
              const res = await editEntry({
                entryId: entry.id,
                start: String(f.get('start') ?? ''),
                end: String(f.get('end') ?? ''),
                breakMinutes: Number(f.get('breakMinutes') ?? 0),
                reason: String(f.get('reason') ?? ''),
              });
              if (!res.ok) return setError(errorText(res.error));
              ref.current?.close();
              toast.show(t('editSaved'));
              router.refresh();
            });
          }}
        >
          <div className="dialog__head">
            <h2 id={titleId}>
              {t('editEntry')} · <bdi>{entry.date}</bdi>
            </h2>
            <Button variant="ghost" icon aria-label={tc('close')} onClick={() => ref.current?.close()}>
              <Icon name="close" size={16} />
            </Button>
          </div>
          <div className="dialog__body">
            <div className="grid-2">
              <Field label={t('start')} name="start" type="time" defaultValue={entry.start} required dir="ltr" />
              <Field label={t('end')} name="end" type="time" defaultValue={entry.end} dir="ltr" />
            </div>
            <Field label={t('breakMinutes')} name="breakMinutes" type="number" min={0} max={600} defaultValue={entry.breakMinutes} dir="ltr" />
            <Field label={t('reason')} name="reason" hint={t('reasonHint')} required maxLength={300} error={error ?? undefined} />
          </div>
          <div className="dialog__foot">
            <div className="sp" />
            <Button onClick={() => ref.current?.close()}>{tc('cancel')}</Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
