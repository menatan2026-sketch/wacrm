'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Field, useToast } from '@ritmo/ui';
import { updateLocation, updateOrgName, updateProfile, type SettingsResult } from './actions';

function useSubmit() {
  const tc = useTranslations('common');
  const tp = useTranslations('people');
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<SettingsResult>, success: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast.show(res.error === 'forbidden' ? tc('forbidden') : res.error === 'invalid' ? tp('invalid') : tc('error'));
      toast.show(success);
      router.refresh();
    });
  return { pending, run };
}

export function ProfileForm({ firstName, lastName, phone }: { firstName: string; lastName: string; phone: string }) {
  const t = useTranslations('settings');
  const tp = useTranslations('people');
  const tc = useTranslations('common');
  const { pending, run } = useSubmit();
  return (
    <form
      className="settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          () => updateProfile({ firstName: String(f.get('firstName')), lastName: String(f.get('lastName')), phone: String(f.get('phone')) }),
          t('profileSaved'),
        );
      }}
    >
      <Field id="profile-first" name="firstName" label={tp('firstName')} defaultValue={firstName} required maxLength={60} />
      <Field id="profile-last" name="lastName" label={tp('lastName')} defaultValue={lastName} maxLength={60} />
      <Field id="profile-phone" name="phone" type="tel" label={tp('phone')} defaultValue={phone} dir="ltr" />
      <Button type="submit" variant="primary" disabled={pending}>{tc('save')}</Button>
    </form>
  );
}

export function OrgForm({ name, canEdit }: { name: string; canEdit: boolean }) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const { pending, run } = useSubmit();
  return (
    <form
      className="settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(() => updateOrgName(String(f.get('orgName'))), t('orgSaved'));
      }}
    >
      <Field id="org-name" name="orgName" label={t('orgName')} defaultValue={name} required maxLength={120} disabled={!canEdit} hint={canEdit ? undefined : t('adminOnly')} />
      {canEdit && <Button type="submit" variant="primary" disabled={pending}>{tc('save')}</Button>}
    </form>
  );
}

export function LocationRow({ id, name, budget, radius, canEdit }: { id: string; name: string; budget: string; radius: number; canEdit: boolean }) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const { pending, run } = useSubmit();
  const [dirty, setDirty] = useState(false);
  return (
    <form
      className="loc-row"
      onChange={() => setDirty(true)}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(() => updateLocation({ id, budget: String(f.get('budget')), radius: String(f.get('radius')) }), t('locationSaved'));
        setDirty(false);
      }}
    >
      <b className="loc-row__name">{name}</b>
      <Field id={`loc-b-${id}`} name="budget" type="number" min={0} step="1" label={t('budget')} defaultValue={budget} disabled={!canEdit} dir="ltr" />
      <Field id={`loc-r-${id}`} name="radius" type="number" min={25} max={5000} step="5" label={t('radius')} defaultValue={radius} disabled={!canEdit} dir="ltr" />
      {canEdit && <Button type="submit" size="sm" disabled={pending || !dirty}>{tc('save')}</Button>}
    </form>
  );
}
