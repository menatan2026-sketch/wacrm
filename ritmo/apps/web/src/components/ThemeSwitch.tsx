'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { setTheme } from '@/server/prefs-actions';
import type { Theme } from '@/i18n/locale';

export function ThemeSwitch({ current }: { current: Theme }) {
  const t = useTranslations('settings');
  const [pending, start] = useTransition();
  const apply = (theme: Theme) => {
    // Crossfade the root (motion.css → view transitions), then persist.
    const swap = () => {
      if (theme === 'system') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', theme);
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (doc.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(swap);
    else swap();
    start(() => setTheme(theme));
  };
  return (
    <div className="rt-seg" role="group" aria-label={t('theme')}>
      {(['system', 'light', 'dark'] as const).map((theme) => (
        <button key={theme} type="button" aria-pressed={current === theme} disabled={pending} onClick={() => apply(theme)}>
          {t(theme === 'system' ? 'themeSystem' : theme === 'light' ? 'themeLight' : 'themeDark')}
        </button>
      ))}
    </div>
  );
}
