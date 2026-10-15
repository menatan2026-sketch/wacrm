import { NextResponse, type NextRequest } from 'next/server';
import { currentUser } from '@/server/auth';
import { requireCtx } from '@/server/context';
import { markRead, messagesSince } from '@/server/chat-queries';

const UUID = /^[0-9a-f-]{36}$/i;

/** Polled by an open conversation: messages after `after`, and marks the conversation read. */
export async function GET(request: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const ctx = await requireCtx();
  const c = request.nextUrl.searchParams.get('c') ?? '';
  const afterParam = request.nextUrl.searchParams.get('after');
  const after = afterParam ? new Date(afterParam) : null;
  if (!UUID.test(c) || (after && Number.isNaN(after.getTime()))) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  try {
    const messages = await ctx.db(async (tx) => {
      const rows = await messagesSince(tx, c, after, 100);
      if (rows.length) await markRead(tx, ctx, c);
      return rows;
    });
    return NextResponse.json(
      { messages: messages.map((m) => ({ ...m, created_at: m.created_at.toISOString() })) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}
