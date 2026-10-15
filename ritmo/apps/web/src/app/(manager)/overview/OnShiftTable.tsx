'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar, Count, EmptyState, Num, Status, type Tint } from '@ritmo/ui';

export interface OnShiftRow {
  id: string;
  name: string;
  initials: string;
  tint: string;
  role: string;
  location: string;
  in: string;
  today: string;
  lateMinutes: number;
  breakMinutes: number | null;
  computer: boolean;
}

type Tab = 'all' | 'late' | 'break' | 'computer';
const PAGE = 8;

export function OnShiftTable({ rows, graceMinutes }: { rows: OnShiftRow[]; graceMinutes: number }) {
  const t = useTranslations('overview');
  const ts = useTranslations('status');
  const [tab, setTab] = useState<Tab>('all');
  const isLate = (r: OnShiftRow) => r.lateMinutes > graceMinutes;
  const filters: Record<Tab, (r: OnShiftRow) => boolean> = {
    all: () => true,
    late: isLate,
    break: (r) => r.breakMinutes !== null,
    computer: (r) => r.computer,
  };
  const visible = rows.filter(filters[tab]);
  const shown = visible.slice(0, PAGE);

  return (
    <section className="panel m-enter" aria-labelledby="onshift-title">
      <div className="panel__head">
        <h2 id="onshift-title">{t('onShiftPanel')}</h2>
        <div className="sp" />
        <div className="tabs-inline" role="group" aria-label={t('onShiftPanel')}>
          {(['all', 'late', 'break', 'computer'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>
              {t(k === 'all' ? 'tabAll' : k === 'late' ? 'tabLate' : k === 'break' ? 'tabBreak' : 'tabComputer')}{' '}
              <Count>{rows.filter(filters[k]).length}</Count>
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState title={t('nobodyOnShift')}>{t('nobodyOnShiftBody')}</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="rt-table">
            <thead>
              <tr>
                <th scope="col">{t('colPerson')}</th>
                <th scope="col">{t('colRole')}</th>
                <th scope="col">{t('colBranch')}</th>
                <th scope="col" className="num">{t('colIn')}</th>
                <th scope="col" className="num">{t('colToday')}</th>
                <th scope="col">{t('colStatus')}</th>
              </tr>
            </thead>
            <tbody className="m-stagger">
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="rt-person">
                      <Avatar initials={r.initials} tint={r.tint as Tint} />
                      <div><b>{r.name}</b></div>
                    </div>
                  </td>
                  <td className="muted">{r.role}</td>
                  <td className="muted">{r.location}</td>
                  <td className="num"><Num>{r.in}</Num></td>
                  <td className="num"><Num>{r.today}</Num></td>
                  <td>
                    {r.breakMinutes !== null ? (
                      <Status tone="break">{ts('onBreak', { minutes: r.breakMinutes })}</Status>
                    ) : isLate(r) ? (
                      <Status tone="late">{ts('late', { minutes: r.lateMinutes })}</Status>
                    ) : r.computer ? (
                      <Status tone="live">{ts('fromComputer')}</Status>
                    ) : (
                      <Status tone="on">{ts('onShift')}</Status>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="panel__foot">
        <span>{t('showing', { shown: shown.length, total: visible.length })}</span>
        <Link href="/time" className="rt-btn rt-btn--link rt-btn--sm">{t('allOnShift')}</Link>
      </div>
    </section>
  );
}
