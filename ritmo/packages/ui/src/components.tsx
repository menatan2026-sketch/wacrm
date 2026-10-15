// React wrappers over the brand kit's reference CSS (rt-* classes in
// styles/components.css). The CSS is the design system; these components
// only add semantics, accessibility and types. Usage rules for each one:
// docs/brand/components/*.md.

import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cx } from './cx';

// ---------------------------------------------------------------- Button
export type ButtonVariant = 'primary' | 'pulse' | 'secondary' | 'ghost' | 'link' | 'danger' | 'beat' | 'onhero';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: boolean;
}

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', icon = false, extra?: string) {
  return cx('rt-btn', `rt-btn--${variant}`, size !== 'md' && `rt-btn--${size}`, icon && 'rt-btn--icon', extra);
}

export function Button({ variant = 'secondary', size = 'md', icon = false, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, icon, className)} {...rest} />;
}

// ---------------------------------------------------------------- Status (dot + word)
export type StatusTone = 'on' | 'live' | 'break' | 'late' | 'pending' | 'off' | 'neutral';

export function Status({ tone = 'neutral', children }: { tone?: StatusTone; children: ReactNode }) {
  return <span className={cx('rt-status', tone !== 'neutral' && `rt-status--${tone}`)}>{children}</span>;
}

export function Pill({ tone, plain, children }: { tone?: 'on' | 'break' | 'late' | 'pending' | 'live' | 'off'; plain?: boolean; children: ReactNode }) {
  return <span className={cx('rt-pill', tone && `rt-pill--${tone}`, plain && 'rt-pill--plain')}>{children}</span>;
}

export function Count({ beat, children, label }: { beat?: boolean; children: ReactNode; label?: string }) {
  return (
    <span className={cx('rt-count', beat && 'rt-count--beat')} aria-label={label}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- Avatar, Kbd, Num
export type Tint = 'green' | 'sun' | 'sky' | 'clay' | 'stone';

export function Avatar({ initials, tint = 'stone', size, label }: { initials: string; tint?: Tint; size?: 'lg'; label?: string }) {
  return (
    <span className={cx('rt-avatar', `rt-avatar--${tint}`, size === 'lg' && 'rt-avatar--lg')} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined}>
      {initials}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rt-kbd">{children}</kbd>;
}

/** Times, numbers, money and IDs stay LTR inside Hebrew text. */
export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return <bdi className={cx('rt-num', className)}>{children}</bdi>;
}

// ---------------------------------------------------------------- Field
export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export function Field({ label, hint, error, id, className, ...rest }: FieldProps) {
  const fieldId = id ?? `f-${rest.name ?? label}`;
  const hintId = hint || error ? `${fieldId}-hint` : undefined;
  return (
    <div className={cx('rt-field', error && 'rt-field--error', className)}>
      <label className="rt-field__label" htmlFor={fieldId}>
        {label}
      </label>
      <input id={fieldId} className="rt-input" aria-invalid={error ? true : undefined} aria-describedby={hintId} {...rest} />
      {(error || hint) && (
        <span id={hintId} className="rt-field__hint" role={error ? 'alert' : undefined}>
          {error ?? hint}
        </span>
      )}
    </div>
  );
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
}

export function SelectField({ label, hint, options, id, className, ...rest }: SelectFieldProps) {
  const fieldId = id ?? `f-${rest.name ?? label}`;
  return (
    <div className={cx('rt-field', className)}>
      <label className="rt-field__label" htmlFor={fieldId}>
        {label}
      </label>
      <select id={fieldId} className="rt-input" {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="rt-field__hint">{hint}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- Stat strip
export function Stats({ children, label, cols = 4 }: { children: ReactNode; label: string; cols?: number }) {
  return (
    <section className="rt-stats m-stagger" aria-label={label} style={{ '--cols': cols } as CSSProperties}>
      {children}
    </section>
  );
}

export interface StatProps {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  delta?: ReactNode;
  deltaTone?: 'up' | 'warn';
  spark?: number[];
  sparkTone?: 'warn';
  meter?: { value: number; label: string; warn?: boolean };
}

export function Stat({ label, value, unit, delta, deltaTone, spark, sparkTone, meter }: StatProps) {
  return (
    <div className="rt-stat">
      <span className="rt-stat__label">{label}</span>
      <div className="rt-stat__row">
        <span className="rt-stat__value">
          {value}
          {unit && <small> {unit}</small>}
        </span>
        {spark && <Spark values={spark} warn={sparkTone === 'warn'} />}
      </div>
      {meter && <Meter value={meter.value} label={meter.label} warn={meter.warn} />}
      {delta && <span className={cx('rt-stat__delta', deltaTone && `rt-stat__delta--${deltaTone}`)}>{delta}</span>}
    </div>
  );
}

export function Spark({ values, warn }: { values: number[]; warn?: boolean }) {
  const max = Math.max(1, ...values);
  return (
    <span className={cx('rt-spark', warn && 'rt-spark--warn')} aria-hidden="true">
      {values.map((v, i) => (
        <i key={i} style={{ blockSize: `${Math.max(3, Math.round((v / max) * 28))}px` }} />
      ))}
    </span>
  );
}

export function Meter({ value, label, warn, className }: { value: number; label: string; warn?: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cx('rt-meter', className)} role="img" aria-label={label}>
      <i className={warn ? 'warn' : undefined} style={{ inlineSize: `${pct}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- Shift block
export function ShiftBlock({
  time,
  who,
  role,
  tint,
  open,
  flag,
  ...rest
}: {
  time: ReactNode;
  who?: ReactNode;
  role?: ReactNode;
  tint?: Tint;
  open?: boolean;
  flag?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role'>) {
  return (
    <button type="button" className={cx('rt-shift', open ? 'rt-shift--open' : `rt-shift--${tint ?? 'stone'}`)} {...rest}>
      <span className="rt-shift__time">{time}</span>
      {who && <span className="rt-shift__who">{who}</span>}
      {role && <span className="rt-shift__role">{role}</span>}
      {flag}
    </button>
  );
}

// ---------------------------------------------------------------- Activity timeline
export interface Segment {
  kind: 'focus' | 'neutral' | 'idle' | 'break' | 'empty';
  weight: number;
}

export function ActivityBar({ segments, label, large }: { segments: Segment[]; label: string; large?: boolean }) {
  return (
    <div className={cx('rt-track', large && 'rt-track--lg')}>
      <div className="rt-track__bar" role="img" aria-label={label}>
        {segments.map((s, i) => (
          <div key={i} className={cx('rt-track__seg', s.kind !== 'empty' && `rt-track__seg--${s.kind}`)} style={{ flex: s.weight }} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Tracking indicator
export function TrackingIndicator({ paused, children }: { paused?: boolean; children: ReactNode }) {
  return (
    <span className={cx('rt-tracking', paused && 'rt-tracking--paused')}>
      <span className={cx('rt-tracking__live', !paused && 'm-live')} aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

// ---------------------------------------------------------------- Banner, empty state, loader, skeleton
export function Banner({ tone, icon, children, actions }: { tone?: 'warning' | 'danger' | 'info'; icon?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className={cx('rt-banner', tone && `rt-banner--${tone}`)} role={tone === 'danger' ? 'alert' : 'status'}>
      {icon}
      <div>{children}</div>
      {actions && <div className="rt-banner__actions">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rt-empty">
      <svg className="rt-empty__art" viewBox="0 0 88 56" aria-hidden="true">
        <rect x="8" y="10" width="44" height="8" rx="4" fill="var(--line-strong)" opacity=".5" />
        <rect x="20" y="24" width="60" height="8" rx="4" fill="var(--brand)" opacity=".7" />
        <rect x="8" y="38" width="30" height="8" rx="4" fill="var(--line-strong)" opacity=".5" />
        <circle cx="70" cy="14" r="4" fill="var(--beat)" />
      </svg>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** The mark's bars keep time. Ritmo's only spinner; always paired with a sentence. */
export function RhythmLoader({ label }: { label: string }) {
  return (
    <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <span className="rt-loader" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>{label}</span>
    </span>
  );
}

export function Skeleton({ width = '100%', height = 14, className }: { width?: string | number; height?: number; className?: string }) {
  return <span className={cx('m-skeleton', className)} style={{ display: 'block', inlineSize: width, blockSize: height }} aria-hidden="true" />;
}
