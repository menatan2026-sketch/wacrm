'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useMessages, useTranslations } from 'next-intl';
import { Button, RhythmLoader, buttonClass } from '@ritmo/ui';
import { askRitmo } from '@/server/ask/actions';
import { Icon } from './Icon';
import { Mark } from './Logo';

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  links?: string[];
  mode?: 'ai' | 'basic';
}

// Times, ranges, dates, money and percentages render as isolated LTR runs,
// otherwise "07:00–14:00" flips inside Hebrew text.
const LTR_RUN = /(₪?\d(?:[\d.,:–\-/]*\d)?%?)/;
function isolateNumbers(text: string) {
  return text.split(LTR_RUN).map((part, i) => (i % 2 ? <bdi key={i}>{part}</bdi> : part));
}

export function AskRitmo({ label }: { label: string }) {
  const t = useTranslations('ask');
  const messages = useMessages() as { ask?: { suggestions?: string[]; links?: Record<string, string> } };
  const suggestions = messages.ask?.suggestions ?? [];
  const linkLabels = messages.ask?.links ?? {};
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [pending, start] = useTransition();

  // ⌘J / Ctrl+J opens the assistant from anywhere in the manager app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        ref.current?.showModal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [turns.length, pending]);

  const ask = (q: string) => {
    const text = q.trim();
    if (!text || pending) return;
    const history = turns.map(({ role, text: body }) => ({ role, text: body }));
    setTurns((prev) => [...prev, { role: 'user', text }]);
    setQuestion('');
    start(async () => {
      const res = await askRitmo({ question: text, history }).catch(() => null);
      setTurns((prev) => [
        ...prev,
        res?.ok
          ? { role: 'assistant', text: res.text, links: res.links, mode: res.mode }
          : { role: 'assistant', text: res && !res.ok && res.error === 'rateLimited' ? t('rateLimited') : t('error') },
      ]);
      inputRef.current?.focus();
    });
  };

  const lastMode = [...turns].reverse().find((x) => x.mode)?.mode;

  return (
    <>
      <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => ref.current?.showModal()} aria-haspopup="dialog">
        <Mark size={16} />
        {label}
      </button>
      <dialog ref={ref} className="dialog ask" aria-labelledby="ask-title" onClose={() => setQuestion('')}>
        <div className="dialog__head">
          <Mark size={18} />
          <h2 id="ask-title">{t('title')}</h2>
          {turns.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setTurns([])}>
              {t('clear')}
            </Button>
          )}
          <Button variant="ghost" icon aria-label={t('close')} onClick={() => ref.current?.close()}>
            <Icon name="close" size={16} />
          </Button>
        </div>
        <div className="ask__log" ref={logRef} role="log" aria-live="polite">
          {turns.length === 0 ? (
            <div className="ask__intro">
              <p className="muted">{t('subtitle')}</p>
              <div className="ask__chips">
                {suggestions.map((s) => (
                  <button key={s} type="button" className="ask__chip" onClick={() => ask(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((turn, i) => (
              <div key={i} className={`ask__turn ask__turn--${turn.role}`}>
                <span className="ask__who">{turn.role === 'user' ? t('you') : t('ritmo')}</span>
                <p className="ask__text" dir="auto">{isolateNumbers(turn.text)}</p>
                {turn.links && turn.links.length > 0 && (
                  <div className="ask__links">
                    {[...new Set(turn.links)].map((href) => (
                      <Link key={href} href={href} className={buttonClass('link', 'sm')} onClick={() => ref.current?.close()}>
                        {linkLabels[href] ?? t('goTo')}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          {pending && (
            <div className="ask__turn ask__turn--assistant">
              <RhythmLoader label={t('thinking')} />
            </div>
          )}
        </div>
        <form
          className="ask__form"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <label htmlFor="ask-input" className="sr-only">{t('title')}</label>
          <input
            ref={inputRef}
            id="ask-input"
            className="rt-input"
            value={question}
            maxLength={500}
            placeholder={t('placeholder')}
            dir="auto"
            autoComplete="off"
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={pending || !question.trim()}>
            <Icon name="send" size={16} />
            {t('send')}
          </Button>
        </form>
        {lastMode && <p className="ask__mode t-caption muted">{lastMode === 'ai' ? t('aiMode') : t('basicMode')}</p>}
      </dialog>
    </>
  );
}
