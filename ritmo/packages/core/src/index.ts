export * from './time';
export * from './policy';
export * from './hours';
export * from './geo';
export * from './schedule';
export * from './payroll';

/** Formats minor units (agorot) as money, e.g. 3842000 → "₪38,420". */
export function formatMoney(minor: number, locale = 'he-IL', currency = 'ILS', fractionDigits = 0): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
    .format(minor / 100)
    .replace(/‏|‎/g, '');
}

/** Two-letter initials for avatars ("דנה לוי" → "דל"). */
export function initials(first: string, last: string): string {
  return `${first.trim().charAt(0)}${last.trim().charAt(0)}`;
}
