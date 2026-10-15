import type { WeekTotals } from './hours';

export interface PayrollRow {
  employeeNo: string | null;
  name: string;
  location: string;
  totals: Pick<WeekTotals, 'regular' | 'overtime1' | 'overtime2' | 'restDay' | 'total'>;
  approved: boolean;
}

export interface PayrollHeaders {
  employeeNo: string;
  name: string;
  location: string;
  regular: string;
  overtime1: string;
  overtime2: string;
  restDay: string;
  total: string;
  approved: string;
  yes: string;
  no: string;
}

const hours = (minutes: number) => (minutes / 60).toFixed(2);

/** Neutralises spreadsheet formula injection and quotes per RFC 4180. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Payroll export as CSV with decimal hours. Starts with a UTF-8 BOM so Excel
 * opens Hebrew names correctly.
 */
export function payrollCsv(rows: PayrollRow[], h: PayrollHeaders): string {
  const header = [h.employeeNo, h.name, h.location, h.regular, h.overtime1, h.overtime2, h.restDay, h.total, h.approved];
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.employeeNo ?? '',
        r.name,
        r.location,
        hours(r.totals.regular),
        hours(r.totals.overtime1),
        hours(r.totals.overtime2),
        hours(r.totals.restDay),
        hours(r.totals.total),
        r.approved ? h.yes : h.no,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
