'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { pgErrorCode } from '@ritmo/db';
import { requireCtx } from '@/server/context';
import { markRead as markReadQuery } from '@/server/chat-queries';

export interface SentMessage {
  id: string;
  createdAt: string;
}

export type ChatResult<T = object> = ({ ok: true } & T) | { ok: false; error: 'forbidden' | 'invalid' | 'error' };

const uuid = z.string().uuid();
const body = z.string().trim().min(1).max(4000);

export async function sendMessage(conversationId: string, text: string): Promise<ChatResult<{ message: SentMessage }>> {
  const ctx = await requireCtx();
  const parsed = body.safeParse(text);
  if (!uuid.safeParse(conversationId).success || !parsed.success) return { ok: false, error: 'invalid' };
  try {
    const message = await ctx.db(async (tx) => {
      const [row] = await tx<{ id: string; created_at: Date }[]>`
        insert into ritmo.messages (org_id, conversation_id, sender_member_id, body)
        values (${ctx.member.orgId}, ${conversationId}, ${ctx.member.memberId}, ${parsed.data})
        returning id, created_at`;
      await markReadQuery(tx, ctx, conversationId);
      return { id: row!.id, createdAt: row!.created_at.toISOString() };
    });
    return { ok: true, message };
  } catch (err) {
    if (pgErrorCode(err) === '42501') return { ok: false, error: 'forbidden' };
    console.error(err);
    return { ok: false, error: 'error' };
  }
}

/** Opens (or finds) the direct conversation with a colleague and goes there. */
export async function openDirect(formData: FormData) {
  const ctx = await requireCtx();
  const other = String(formData.get('member') ?? '');
  if (!uuid.safeParse(other).success) redirect('/chat');
  const id = await ctx.db(async (tx) => {
    const [row] = await tx<{ id: string }[]>`select ritmo.open_dm(${ctx.member.orgId}, ${other}) as id`;
    return row!.id;
  });
  redirect(`/chat?c=${id}`);
}
