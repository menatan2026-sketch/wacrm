'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button, useToast } from '@ritmo/ui';
import { requestCorrection } from '../actions';

export function CorrectionForm() {
  const t = useTranslations('collected');
  const tm = useTranslations('me');
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) return <Button onClick={() => setOpen(true)}>{t('correction')}</Button>;
  return (
    <form
      className="correction"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await requestCorrection(note);
          if (!res.ok) return setError(res.error === 'invalid' ? t('correctionInvalid') : tm('error'));
          toast.show(t('correctionSent'));
          setNote('');
          setError(null);
          setOpen(false);
        });
      }}
    >
      <label className="rt-field__label" htmlFor="correction-note">
        {t('correctionLabel')}
      </label>
      <textarea
        id="correction-note"
        value={note}
        maxLength={300}
        onChange={(e) => setNote(e.target.value)}
        aria-describedby="correction-hint"
        aria-invalid={error ? true : undefined}
      />
      <span id="correction-hint" className="t-caption muted">
        {error ?? t('correctionHint')}
      </span>
      <div className="doc__actions">
        <Button type="submit" variant="primary" disabled={pending}>
          {tm('send')}
        </Button>
        <Button onClick={() => setOpen(false)}>{tm('cancelRequest')}</Button>
      </div>
    </form>
  );
}
