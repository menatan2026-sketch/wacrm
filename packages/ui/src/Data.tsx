import type { ReactNode } from "react";
import { cn } from "./cn";

export function KpiTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" | "warning" }) {
  return (
    <div className="flex flex-col gap-1 rounded-m border border-border-subtle bg-surface-raised p-4">
      <span className="text-xs font-medium tracking-wide text-text-secondary">{label}</span>
      <span className={cn("text-2xl font-medium tabular-nums", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-text-primary")}>{value}</span>
      {hint && <span className="text-xs text-text-secondary">{hint}</span>}
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  numeric?: boolean;
  className?: string;
}

/** Dense, semantic data table (admin). Collapses to stacked rows below md. */
export function DataTable<T>({ columns, rows, rowKey, caption, empty }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; caption: string; empty: ReactNode }) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <div className="overflow-x-auto rounded-m border border-border-subtle bg-surface-raised">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface-sunken">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("h-9 px-3 text-start text-xs font-semibold text-text-secondary", c.numeric && "text-end")}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-t border-border-subtle hover:bg-surface-base">
              {columns.map((c) => (
                <td key={c.key} className={cn("h-11 px-3 align-middle text-text-primary", c.numeric && "text-end tabular-nums", c.className)}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Isolate LTR technical values (order numbers, measurements, file names) inside RTL text. */
export function Ltr({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return (
    <bdi dir="ltr" className={mono ? "font-mono" : undefined}>
      {children}
    </bdi>
  );
}
