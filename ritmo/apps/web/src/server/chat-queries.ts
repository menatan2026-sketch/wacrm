import 'server-only';
import type { Tx } from '@ritmo/db';
import type { Ctx } from './context';

export interface ConversationRow {
  id: string;
  kind: 'channel' | 'dm';
  name: string | null;
  others: string | null;
  member_count: number;
  unread: number;
  last_body: string | null;
  last_message_at: Date | null;
}

export interface MessageRow {
  id: string;
  body: string;
  created_at: Date;
  sender_member_id: string;
  first_name: string;
  last_name: string;
  avatar_color: 'green' | 'sun' | 'sky' | 'clay' | 'stone';
}

export async function conversations(ctx: Ctx): Promise<ConversationRow[]> {
  const me = ctx.member.memberId;
  return ctx.db((tx) => tx<ConversationRow[]>`
    select c.id, c.kind, c.name, c.last_message_at,
      (select string_agg(o.first_name || ' ' || o.last_name, ', ' order by o.first_name)
         from ritmo.conversation_members x join ritmo.members o on o.id = x.member_id
        where x.conversation_id = c.id and x.member_id <> ${me}) as others,
      (select count(*)::int from ritmo.conversation_members x where x.conversation_id = c.id) as member_count,
      (select count(*)::int from ritmo.messages m
        where m.conversation_id = c.id and m.created_at > cm.last_read_at and m.sender_member_id <> ${me}) as unread,
      (select m.body from ritmo.messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as last_body
    from ritmo.conversations c
    join ritmo.conversation_members cm on cm.conversation_id = c.id and cm.member_id = ${me}
    where c.org_id = ${ctx.member.orgId}
    order by (c.kind = 'channel') desc, c.last_message_at desc nulls last, c.name`);
}

export async function messagesSince(tx: Tx, conversationId: string, after: Date | null, limit = 100): Promise<MessageRow[]> {
  const rows = await tx<MessageRow[]>`
    select m.id, m.body, m.created_at, m.sender_member_id, s.first_name, s.last_name, s.avatar_color
    from ritmo.messages m join ritmo.members s on s.id = m.sender_member_id
    where m.conversation_id = ${conversationId} ${after ? tx`and m.created_at > ${after}` : tx``}
    order by m.created_at desc limit ${limit}`;
  return rows.reverse();
}

export async function markRead(tx: Tx, ctx: Ctx, conversationId: string) {
  await tx`
    update ritmo.conversation_members set last_read_at = now()
    where conversation_id = ${conversationId} and member_id = ${ctx.member.memberId}`;
}

export async function colleagues(ctx: Ctx) {
  return ctx.db((tx) => tx<{ id: string; name: string }[]>`
    select id, first_name || ' ' || last_name as name from ritmo.members
    where org_id = ${ctx.member.orgId} and status = 'active' and id <> ${ctx.member.memberId}
    order by first_name, last_name`);
}
