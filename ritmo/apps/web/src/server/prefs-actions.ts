'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { asApp } from '@ritmo/db';
import { LOCALE_COOKIE, THEME_COOKIE, isLocale, type Theme } from '@/i18n/locale';
import { currentUser } from './auth';

const opts = { path: '/', sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 365 };

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, opts);
  const user = await currentUser();
  if (user) await asApp((tx) => tx`update ritmo_auth.users set locale = ${locale} where id = ${user.id}`);
  revalidatePath('/', 'layout');
}

export async function setTheme(theme: Theme) {
  if (!['system', 'light', 'dark'].includes(theme)) return;
  (await cookies()).set(THEME_COOKIE, theme, opts);
  const user = await currentUser();
  if (user) await asApp((tx) => tx`update ritmo_auth.users set theme = ${theme} where id = ${user.id}`);
  revalidatePath('/', 'layout');
}
