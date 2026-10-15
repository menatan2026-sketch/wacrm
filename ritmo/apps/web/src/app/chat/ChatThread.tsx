'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar, Banner, Button, EmptyState, type Tint } from '@ritmo/ui';
import { Icon } from '@/components/Icon';
import { sendMessage } from './actions';

export interface ThreadMessage {
  id: string;
  body: string;
  created_at: string;
  sender_member_id: string;
  first_name: string;
  last_name: string;
  avatar_color: Tint;
  pending?: 'sending' | 'failed';
}

const POLL_MS = 3000;
const initialsOf = (m: ThreadMessage) => `${m.first_name[0] ?? ''}${m.last_name[0] ?? ''}`;

export function ChatThread({
  conversationId,
  initial,
  me,
  timezone,
  locale,
}: {
  conversationId: string;
  initial: ThreadMessage[];
  me: { id: string; firstName: string; lastName: string; avatarColor: Tint };
  timezone: string;
  locale: string;
}) {
  const t = useTranslations('chat');
  const [messages, setMessages] = useState<ThreadMessage[]>(initial);
  const [text, setText] = useState('');
  const [online, setOnline] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const latest = useRef(initial.at(-1)?.created_at ?? null);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timezone }).format(
      new Date(iso),
    );

  const merge = useCallback((incoming: ThreadMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    latest.current = incoming.at(-1)!.created_at;
  }, []);

  // Poll for new messages (also marks the conversation read on the server).
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const q = new URLSearchParams({ c: conversationId, ...(latest.current ? { after: latest.current } : {}) });
        const res = await fetch(`/api/chat/messages?${q}`, { cache: 'no-store' });
        if (!res.ok || stopped) return;
        const data = (await res.json()) as { messages: ThreadMessage[] };
        merge(data.messages);
      } catch {
        // Network hiccup: the next tick tries again; the offline banner covers longer outages.
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [conversationId, merge]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const deliver = useCallback(
    async (tempId: string, body: string) => {
      const res = await sendMessage(conversationId, body).catch(() => null);
      setMessages((prev) =>
        prev.map((m) =>
          m.id !== tempId ? m : res?.ok ? { ...m, id: res.message.id, created_at: res.message.createdAt, pending: undefined } : { ...m, pending: 'failed' },
        ),
      );
      if (res?.ok) latest.current = res.message.createdAt;
    },
    [conversationId],
  );

  // Offline: messages wait and are retried when the connection returns.
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const retry = () => {
      update();
      const failed = messagesRef.current.filter((m) => m.pending === 'failed');
      if (!failed.length) return;
      setMessages((prev) => prev.map((m) => (m.pending === 'failed' ? { ...m, pending: 'sending' } : m)));
      failed.forEach((m) => void deliver(m.id, m.body));
    };
    update();
    window.addEventListener('online', retry);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', retry);
      window.removeEventListener('offline', update);
    };
  }, [deliver]);

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    const tempId = `tmp-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId, body, created_at: new Date().toISOString(), sender_member_id: me.id,
        first_name: me.firstName, last_name: me.lastName, avatar_color: me.avatarColor, pending: navigator.onLine ? 'sending' : 'failed',
      },
    ]);
    setText('');
    if (navigator.onLine) void deliver(tempId, body);
  };

  return (
    <>
      {!online && (
        <div style={{ padding: 'var(--space-3) var(--space-5) 0' }}>
          <Banner tone="warning">{t('offline')}</Banner>
        </div>
      )}
      <div className="chat__msgs" ref={listRef} role="log" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 ? (
          <EmptyState title={t('empty')}>{t('emptyBody')}</EmptyState>
        ) : (
          messages.map((m) => {
            const mine = m.sender_member_id === me.id;
            return (
              <div key={m.id} className={`msg${mine ? ' msg--mine' : ''}`}>
                <Avatar initials={initialsOf(m)} tint={m.avatar_color} />
                <div className="msg__body">
                  <span className="msg__meta">
                    <b>{mine ? t('you') : `${m.first_name} ${m.last_name}`.trim()}</b> · <bdi>{time(m.created_at)}</bdi>
                    {m.pending === 'sending' && <> · {t('sending')}</>}
                    {m.pending === 'failed' && <span className="msg__failed"> · {t('failed')}</span>}
                  </span>
                  <span className="msg__text" dir="auto">{m.body}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form
        className="chat__composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="chat-input" className="sr-only">{t('placeholder')}</label>
        <textarea
          id="chat-input"
          className="rt-input"
          value={text}
          maxLength={4000}
          placeholder={t('placeholder')}
          dir="auto"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button type="submit" variant="primary" disabled={!text.trim()}>
          <Icon name="send" size={16} />
          {t('send')}
        </Button>
      </form>
    </>
  );
}
