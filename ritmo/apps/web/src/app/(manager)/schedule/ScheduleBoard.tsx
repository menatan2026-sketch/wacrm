'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Avatar, Button, Field, Meter, Num, SelectField, ShiftBlock, useToast } from '@ritmo/ui';
import { Icon } from '@/components/Icon';
import type { BoardMember, BoardShift, Tint } from './data';
import { deleteShift, moveShift, saveShift } from './actions';

interface Day { date: string; label: string; short: string; today: boolean }
export const NEW_SHIFT_EVENT = 'ritmo:new-shift';

type Draft = Omit<BoardShift, 'draft' | 'conflict' | 'request' | 'id'> & { id?: string };

export function NewShiftButton({ label }: { label: string }) {
  return (
    <Button onClick={() => window.dispatchEvent(new Event(NEW_SHIFT_EVENT))} aria-haspopup="dialog">
      <Icon name="plus" size={16} />
      {label}
    </Button>
  );
}

export function ScheduleBoard({
  locationId, days, members, positions, shifts, openNew,
}: {
  locationId: string;
  days: Day[];
  members: BoardMember[];
  positions: Array<{ id: string; name: string; tint: Tint }>;
  shifts: BoardShift[];
  openNew: boolean;
}) {
  const t = useTranslations('schedule');
  const tc = useTranslations('common');
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const blank = (memberId: string | null, date: string): Draft => ({
    memberId, date, positionId: members.find((m) => m.id === memberId)?.positionId ?? positions[0]?.id ?? null,
    start: '09:00', end: '17:00', breakMinutes: 30, notes: '',
  });
  const firstDay = days.find((d) => d.today)?.date ?? days[0]!.date;
  // Arriving with ?new=1 (e.g. from the overview) opens the create dialog.
  const [draft, setDraft] = useState<Draft | null>(() => (openNew ? blank(null, firstDay) : null));
  const [error, setError] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const pos = new Map(positions.map((p) => [p.id, p]));
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name ?? '';

  const open = (d: Draft) => {
    setError(null);
    setDraft(d);
  };

  useEffect(() => {
    if (draft && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [draft]);

  useEffect(() => {
    if (!openNew) return;
    const next = new URLSearchParams(params);
    next.delete('new');
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
    // Only on arrival with ?new=1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNew]);

  // The page head's "New shift" button lives outside this component.
  useEffect(() => {
    const onNew = () => open(blank(null, firstDay));
    window.addEventListener(NEW_SHIFT_EVENT, onNew);
    return () => window.removeEventListener(NEW_SHIFT_EVENT, onNew);
  });

  const close = () => {
    dialog.current?.close();
    setDraft(null);
  };

  const message = (error: string, memberId: string | null) =>
    error === 'overlap' ? t('overlap', { name: nameOf(memberId) })
      : error === 'endBeforeStart' || error === 'tooLong' || error === 'breakTooLong' ? t(error)
        : error === 'forbidden' ? tc('forbidden') : tc('error');

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!draft) return;
    const f = new FormData(e.currentTarget);
    const memberId = String(f.get('member') || '') || null;
    const input = {
      id: draft.id, locationId, memberId, positionId: String(f.get('position') || '') || null,
      date: String(f.get('date')), start: String(f.get('start')), end: String(f.get('end')),
      breakMinutes: Number(f.get('break') || 0), notes: String(f.get('notes') ?? ''),
    };
    start(async () => {
      const res = await saveShift(input);
      if (res.ok) {
        const moved = draft.id && (draft.date !== input.date || draft.memberId !== memberId);
        close();
        toast.show(moved ? t('moved') : t('saved'));
      } else setError(message(res.error, memberId));
    });
  };

  const remove = () => {
    if (!draft?.id) return;
    const id = draft.id;
    start(async () => {
      const res = await deleteShift(id);
      if (res.ok) {
        close();
        toast.show(t('deleted'));
      } else setError(message(res.error, null));
    });
  };

  const drop = (e: React.DragEvent, memberId: string | null, date: string) => {
    e.preventDefault();
    setDropKey(null);
    const id = e.dataTransfer.getData('text/x-shift');
    const s = shifts.find((x) => x.id === id);
    if (!s || (s.memberId === memberId && s.date === date)) return;
    start(async () => {
      const res = await moveShift(id, memberId, date);
      toast.show(res.ok ? t('moved') : message(res.error, memberId));
    });
  };

  const cell = (memberId: string | null, day: Day, extra?: string) => {
    const key = `${memberId ?? 'open'}:${day.date}`;
    const list = shifts.filter((s) => s.memberId === memberId && s.date === day.date);
    return (
      <div
        key={key}
        className={['cell', day.today && 'col-today', extra, dropKey === key && 'drop-target'].filter(Boolean).join(' ')}
        onDragOver={(e) => { e.preventDefault(); setDropKey(key); }}
        onDragLeave={() => setDropKey((k) => (k === key ? null : k))}
        onDrop={(e) => drop(e, memberId, day.date)}
      >
        {list.map((s) => {
          const p = s.positionId ? pos.get(s.positionId) : undefined;
          const flags = [
            s.conflict && t(s.conflict === 'overlap' ? 'conflictOverlap' : 'shortRest'),
            s.request && t(s.request === 'swap' ? 'pendingSwap' : s.request === 'claim' ? 'pendingClaim' : 'pendingDrop'),
            s.draft && t('draftTag'),
          ].filter(Boolean);
          return (
            <div key={s.id} className="sched__item">
              <ShiftBlock
                draggable
                onDragStart={(e) => { e.dataTransfer.setData('text/x-shift', s.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => setDropKey(null)}
                onClick={() => open({ ...s })}
                open={!s.memberId}
                tint={p?.tint}
                data-draft={s.draft || undefined}
                time={<Num>{`${s.start}–${s.end}`}</Num>}
                who={p?.name ?? (s.memberId ? undefined : t('openShift'))}
                aria-label={[`${p?.name ?? t('openShift')} ${s.start}–${s.end}`, ...flags].join(', ')}
                aria-haspopup="dialog"
              />
              {s.conflict && (
                <span className="flag flag--danger"><Icon name="alert" size={12} />{flags[0]}</span>
              )}
              {s.request && (
                <span className="flag flag--warn"><Icon name="swap" size={12} />
                  {t(s.request === 'swap' ? 'pendingSwap' : s.request === 'claim' ? 'pendingClaim' : 'pendingDrop')}
                </span>
              )}
            </div>
          );
        })}
        <button type="button" className="add-in-cell" aria-label={t('addOn', { day: day.label })} onClick={() => open(blank(memberId, day.date))}>
          <Icon name="plus" size={14} />
        </button>
      </div>
    );
  };

  const openCount = shifts.filter((s) => !s.memberId).length;

  return (
    <>
      <div className="sched-scroll" aria-busy={pending || undefined}>
        <div className="sched">
          <div className="d"><span>{t('team')}</span></div>
          {days.map((d) => (
            <div key={d.date} className={d.today ? 'd today col-today' : 'd'}>
              <b>{d.short}</b><Num>{d.label}</Num>
            </div>
          ))}
          {members.map((m) => {
            const over = m.contractMinutes !== null && m.scheduledMinutes > m.contractMinutes;
            const h = (n: number) => Math.round((n / 60) * 10) / 10;
            return [
              <div key={m.id} className="who">
                <Avatar initials={m.initials} tint={m.tint} />
                <div>
                  <b>{m.name}</b>
                  <span className="who__hrs">
                    {m.contractMinutes !== null && (
                      <Meter value={m.contractMinutes ? (m.scheduledMinutes / m.contractMinutes) * 100 : 0} warn={over}
                        label={t('hoursOfContract', { scheduled: h(m.scheduledMinutes), contract: h(m.contractMinutes) })} />
                    )}
                    <Num>{m.contractMinutes !== null ? `${h(m.scheduledMinutes)}/${h(m.contractMinutes)}` : h(m.scheduledMinutes)}</Num> {tc('hoursUnit')}
                  </span>
                  {over && <span className="flag flag--warn"><Icon name="alert" size={12} />{t('overContract')}</span>}
                </div>
              </div>,
              ...days.map((d) => cell(m.id, d)),
            ];
          })}
          <div className="who openrow">
            <span className="rt-avatar open-avatar" aria-hidden="true"><Icon name="plus" size={16} /></span>
            <div><b>{t('openRow')}</b><span className="who__hrs">{t('openCount', { count: openCount })}</span></div>
          </div>
          {days.map((d) => cell(null, d, 'openrow'))}
        </div>
      </div>
      <div className="sched-foot muted">
        <div className="rt-legend" aria-label={t('legend')}>
          {positions.map((p) => <span key={p.id}><i style={{ background: `var(--shift-${p.tint})` }} />{p.name}</span>)}
        </div>
        <span className="sched-foot__hint">{t('footer')}</span>
      </div>

      <dialog ref={dialog} className="dialog" aria-labelledby="shift-dialog-title" onClose={() => setDraft(null)}>
        {draft && (
          <form onSubmit={submit} noValidate>
            <div className="dialog__head">
              <h2 id="shift-dialog-title">{draft.id ? t('dialogEdit') : t('dialogNew')}</h2>
              <Button variant="ghost" size="sm" icon onClick={close} aria-label={tc('close')}><Icon name="close" /></Button>
            </div>
            <div className="dialog__body">
              <SelectField name="member" label={t('fieldPerson')} defaultValue={draft.memberId ?? ''}
                options={[{ value: '', label: t('openShift') }, ...members.map((m) => ({ value: m.id, label: m.name }))]} />
              <SelectField name="position" label={t('fieldPosition')} defaultValue={draft.positionId ?? ''}
                options={[{ value: '', label: '—' }, ...positions.map((p) => ({ value: p.id, label: p.name }))]} />
              <Field name="date" type="date" label={t('fieldDate')} defaultValue={draft.date} required />
              <div className="grid-2">
                <Field name="start" type="time" label={t('fieldStart')} defaultValue={draft.start} required />
                <Field name="end" type="time" label={t('fieldEnd')} defaultValue={draft.end} required hint={t('overnightHint')} />
              </div>
              <Field name="break" type="number" min={0} max={240} step={5} label={t('fieldBreak')} defaultValue={draft.breakMinutes} />
              <Field name="notes" label={t('fieldNotes')} defaultValue={draft.notes} maxLength={500} />
              {error && <p className="dialog__error" role="alert"><Icon name="alert" size={16} />{error}</p>}
            </div>
            <div className="dialog__foot">
              {draft.id && (
                <Button variant="ghost" onClick={remove} disabled={pending}><Icon name="trash" size={16} />{tc('delete')}</Button>
              )}
              <span className="sp" />
              <Button onClick={close}>{tc('cancel')}</Button>
              <Button type="submit" variant="primary" disabled={pending}>{tc('save')}</Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
