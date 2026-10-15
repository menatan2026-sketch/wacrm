'use server';

import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { requireManager } from '../context';
import { answer, type AskAnswer } from './engine';

const input = z.object({
  question: z.string().trim().min(1).max(500),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(4000) })).max(12),
});

// Simple per-user limit (per server instance): 30 questions per 10 minutes.
const WINDOW_MS = 10 * 60_000;
const LIMIT = 30;
const recent = new Map<string, number[]>();

export type AskResult = ({ ok: true } & AskAnswer) | { ok: false; error: 'invalid' | 'rateLimited' | 'error' };

export async function askRitmo(raw: z.input<typeof input>): Promise<AskResult> {
  const ctx = await requireManager();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const now = Date.now();
  const times = (recent.get(ctx.user.id) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= LIMIT) return { ok: false, error: 'rateLimited' };
  recent.set(ctx.user.id, [...times, now]);
  try {
    const locale = (await getLocale()) === 'en' ? 'en' : 'he';
    const res = await answer(ctx, parsed.data.history, parsed.data.question, locale);
    return { ok: true, ...res };
  } catch (err) {
    console.error(err);
    return { ok: false, error: 'error' };
  }
}
