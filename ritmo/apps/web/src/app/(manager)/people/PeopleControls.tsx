'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Banner, Button, Field, SelectField, useToast } from '@ritmo/ui';
import { Icon } from '@/components/Icon';
import { createInvite, createMember, updateMember, type MemberInput, type PeopleError } from './actions';

type Role = 'owner' | 'admin' | 'manager' | 'employee';

export interface MemberFormValues {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  positionId: string;
  locationId: string;
  role: Role;
  rate: string;
  contractHours: string;
  worksOn: 'site' | 'computer' | 'both';
}

export interface FormOptions {
  positions: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  roles: Role[];
}

function useErrorText() {
  const t = useTranslations('people');
  const tc = useTranslations('common');
  return (e: PeopleError) =>
    e === 'forbidden' ? tc('forbidden') : e === 'duplicateEmail' ? t('duplicateEmail') : e === 'invalid' ? t('invalid') : tc('error');
}

/** Add (no `initial.id`) or edit a person. */
export function MemberDialog({ initial, options, trigger }: { initial: MemberFormValues; options: FormOptions; trigger: 'add' | 'edit' }) {
  const t = useTranslations('people');
  const tc = useTranslations('common');
  const tr = useTranslations('roles');
  const toast = useToast();
  const router = useRouter();
  const errorText = useErrorText();
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const p = `m-${initial.id ?? 'new'}`;
  const name = `${initial.firstName} ${initial.lastName}`.trim();

  return (
    <>
      {trigger === 'add' ? (
        <Button variant="primary" onClick={() => ref.current?.showModal()}>
          <Icon name="plus" size={16} />
          {t('add')}
        </Button>
      ) : (
        <Button size="sm" variant="ghost" icon aria-label={`${t('edit')} ${name}`} onClick={() => ref.current?.showModal()}>
          <Icon name="edit" size={16} />
        </Button>
      )}
      <dialog ref={ref} className="dialog" aria-labelledby={`${p}-title`} onClose={() => setError(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const v = (k: string) => String(f.get(k) ?? '');
            const input: MemberInput = {
              firstName: v('firstName'),
              lastName: v('lastName'),
              email: v('email'),
              phone: v('phone'),
              positionId: v('positionId'),
              locationId: v('locationId'),
              role: v('role') as Role,
              rate: v('rate') === '' ? undefined : v('rate'),
              contractHours: v('contractHours') === '' ? undefined : v('contractHours'),
              worksOn: v('worksOn') as MemberFormValues['worksOn'],
            };
            start(async () => {
              const res = initial.id ? await updateMember(initial.id, input) : await createMember(input);
              if (!res.ok) return setError(errorText(res.error));
              ref.current?.close();
              const who = `${input.firstName} ${input.lastName}`.trim();
              toast.show(initial.id ? t('updated', { name: who }) : t('created', { name: who }));
              if (!initial.id) form.reset();
              router.refresh();
            });
          }}
        >
          <div className="dialog__head">
            <h2 id={`${p}-title`}>{initial.id ? t('editTitle') : t('newTitle')}</h2>
            <Button variant="ghost" icon aria-label={tc('close')} onClick={() => ref.current?.close()}>
              <Icon name="close" size={16} />
            </Button>
          </div>
          <div className="dialog__body">
            {error && <Banner tone="danger">{error}</Banner>}
            <div className="grid-2">
              <Field id={`${p}-first`} name="firstName" label={t('firstName')} defaultValue={initial.firstName} required maxLength={60} />
              <Field id={`${p}-last`} name="lastName" label={t('lastName')} defaultValue={initial.lastName} maxLength={60} />
            </div>
            <div className="grid-2">
              <Field id={`${p}-email`} name="email" type="email" label={t('email')} defaultValue={initial.email} dir="ltr" />
              <Field id={`${p}-phone`} name="phone" type="tel" label={t('phone')} defaultValue={initial.phone} dir="ltr" />
            </div>
            <div className="grid-2">
              <SelectField
                id={`${p}-pos`}
                name="positionId"
                label={t('position')}
                defaultValue={initial.positionId}
                options={[{ value: '', label: t('positionNone') }, ...options.positions.map((o) => ({ value: o.id, label: o.name }))]}
              />
              <SelectField
                id={`${p}-loc`}
                name="locationId"
                label={t('location')}
                defaultValue={initial.locationId}
                required
                options={options.locations.map((o) => ({ value: o.id, label: o.name }))}
              />
            </div>
            <div className="grid-2">
              <SelectField
                id={`${p}-role`}
                name="role"
                label={t('access')}
                defaultValue={initial.role}
                options={(options.roles.includes(initial.role) ? options.roles : [initial.role, ...options.roles]).map((r) => ({ value: r, label: tr(r) }))}
              />
              <SelectField
                id={`${p}-works`}
                name="worksOn"
                label={t('worksOn')}
                defaultValue={initial.worksOn}
                options={[
                  { value: 'site', label: t('worksOnSite') },
                  { value: 'computer', label: t('worksOnComputer') },
                  { value: 'both', label: t('worksOnBoth') },
                ]}
              />
            </div>
            <div className="grid-2">
              <Field id={`${p}-rate`} name="rate" type="number" min={0} max={10000} step="0.01" label={t('rate')} defaultValue={initial.rate} dir="ltr" />
              <Field id={`${p}-hours`} name="contractHours" type="number" min={0} max={80} step="0.5" label={t('contractHours')} defaultValue={initial.contractHours} dir="ltr" />
            </div>
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

export function InviteButton({ memberId, name }: { memberId: string; name: string }) {
  const t = useTranslations('people');
  const tc = useTranslations('common');
  const toast = useToast();
  const router = useRouter();
  const errorText = useErrorText();
  const ref = useRef<HTMLDialogElement>(null);
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const p = `inv-${memberId}`;

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await createInvite(memberId);
            if (!res.ok) return toast.show(errorText(res.error));
            setLink(res.link);
            ref.current?.showModal();
          })
        }
      >
        <Icon name="send" size={16} />
        {t('invite')}
      </Button>
      <dialog
        ref={ref}
        className="dialog"
        aria-labelledby={`${p}-title`}
        onClose={() => {
          setLink(null);
          router.refresh();
        }}
      >
        <div className="dialog__head">
          <h2 id={`${p}-title`}>{t('inviteTitle', { name })}</h2>
          <Button variant="ghost" icon aria-label={tc('close')} onClick={() => ref.current?.close()}>
            <Icon name="close" size={16} />
          </Button>
        </div>
        <div className="dialog__body">
          <p className="muted">{t('inviteCreated')}</p>
          <Field id={`${p}-link`} label={t('copyLink')} value={link ?? ''} readOnly dir="ltr" onFocus={(e) => e.currentTarget.select()} hint={t('inviteHint')} />
        </div>
        <div className="dialog__foot">
          <div className="sp" />
          <Button
            variant="primary"
            onClick={async () => {
              if (!link) return;
              try {
                await navigator.clipboard.writeText(link);
                toast.show(t('copied'));
              } catch {
                document.getElementById(`${p}-link`)?.focus();
              }
            }}
          >
            <Icon name="file" size={16} />
            {t('copyLink')}
          </Button>
        </div>
      </dialog>
    </>
  );
}
