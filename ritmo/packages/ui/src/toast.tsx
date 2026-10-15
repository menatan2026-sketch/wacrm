'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ToastItem {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface ToastApi {
  show: (message: string, action?: ToastItem['action']) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

/** Toasts rise from the block-end edge (motion.css m-toast), pause on hover/focus, 5s otherwise. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const show = useCallback<ToastApi['show']>((message, action) => {
    const id = next.current++;
    setItems((all) => [...all.slice(-2), { id, message, action }]);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          insetBlockEnd: 'var(--space-6)',
          insetInlineStart: '50%',
          transform: 'translateX(-50%)',
          zIndex: 'var(--z-toast)' as unknown as number,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {items.map((t) => (
          <Toast key={t.id} item={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(onDone, 5000);
    return () => clearTimeout(t);
  }, [paused, onDone]);

  return (
    <div
      className="rt-toast m-toast"
      role="status"
      style={{ pointerEvents: 'auto' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
      <span>{item.message}</span>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.run();
            onDone();
          }}
        >
          {item.action.label}
        </button>
      )}
    </div>
  );
}
