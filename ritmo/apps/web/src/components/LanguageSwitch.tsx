'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { setLocale } from '@/server/prefs-actions';

/** Segmented he/en switch. Labels are always in their own language. */
export function LanguageSwitch() {
  const locale = useLocale();
  const [pending, start] = useTransition();
  return (
    <div className="rt-seg" role="group" aria-label="Language / שפה">
      {[
        { code: 'he', label: 'עברית' },
        { code: 'en', label: 'English' },
      ].map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          aria-pressed={locale === l.code}
          disabled={pending}
          onClick={() => start(() => setLocale(l.code))}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
