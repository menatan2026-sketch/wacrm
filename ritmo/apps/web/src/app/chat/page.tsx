import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Count, EmptyState, buttonClass } from '@ritmo/ui';
import { AppFrame } from '@/components/AppFrame';
import { Icon } from '@/components/Icon';
import { requireCtx, type Ctx } from '@/server/context';
import { colleagues, conversations, markRead, messagesSince, type ConversationRow } from '@/server/chat-queries';
import { MeTabs } from '../me/MeTabs';
import { openDirect } from './actions';
import { ChatThread, type ThreadMessage } from './ChatThread';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('chat'))('title') };
}

const UUID = /^[0-9a-f-]{36}$/i;

async function Frame({ ctx, title, children }: { ctx: Ctx; title: string; children: React.ReactNode }) {
  if (ctx.isManager) return <AppFrame ctx={ctx} crumb={title}>{children}</AppFrame>;
  const tm = await getTranslations('me');
  return (
    <div className="mapp">
      <main id="main" className="mapp__main">{children}</main>
      <MeTabs labels={{ today: tm('tabToday'), shifts: tm('tabShifts'), chat: tm('tabChat'), me: tm('tabMe') }} />
    </div>
  );
}

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const ctx = await requireCtx();
  const t = await getTranslations('chat');
  const locale = await getLocale();
  const { c } = await searchParams;
  const [convs, people] = await Promise.all([conversations(ctx), colleagues(ctx)]);
  const mobile = !ctx.isManager;
  const current: ConversationRow | null = convs.find((x) => x.id === c && UUID.test(c)) ?? (mobile ? null : (convs[0] ?? null));
  const initial = current
    ? await ctx.db(async (tx) => {
        const rows = await messagesSince(tx, current.id, null, 100);
        await markRead(tx, ctx, current.id);
        return rows;
      })
    : [];
  const title = (x: ConversationRow) => (x.kind === 'channel' ? `# ${x.name}` : (x.others ?? '—'));
  const channels = convs.filter((x) => x.kind === 'channel');
  const direct = convs.filter((x) => x.kind === 'dm');

  const item = (x: ConversationRow) => (
    <Link key={x.id} href={`/chat?c=${x.id}`} className="chat__item" aria-current={current?.id === x.id ? 'true' : undefined}>
      <span className="chat__item-main">
        <span className="chat__item-title">{title(x)}</span>
        {x.last_body && <span className="chat__item-last" dir="auto">{x.last_body}</span>}
      </span>
      {x.unread > 0 && x.id !== current?.id && <Count beat label={String(x.unread)}>{x.unread}</Count>}
    </Link>
  );

  return (
    <Frame ctx={ctx} title={t('title')}>
      {!mobile && (
        <div className="head m-enter">
          <div>
            <h1 className="t-h1">{t('title')}</h1>
          </div>
        </div>
      )}
      {mobile && !current && (
        <div className="ptop">
          <h1>{t('title')}</h1>
        </div>
      )}
      <div className={`chat${mobile ? ' chat--mobile' : ''}`}>
        {(!mobile || !current) && (
          <nav className="chat__list" aria-label={t('title')}>
            <div className="chat__group">{t('channels')}</div>
            {channels.map(item)}
            <div className="chat__group">{t('direct')}</div>
            {direct.map(item)}
            <form action={openDirect} className="chat__new">
              <label htmlFor="new-dm" className="chat__group">{t('newDirect')}</label>
              <div className="chat__new-row">
                <select id="new-dm" name="member" className="rt-input" required defaultValue="">
                  <option value="" disabled>{t('pickPerson')}</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button type="submit" className={buttonClass('secondary', 'md', true)} aria-label={t('newDirect')}>
                  <Icon name="send" size={16} />
                </button>
              </div>
            </form>
          </nav>
        )}
        {current ? (
          <section className="chat__main" aria-labelledby="chat-title">
            <header className="chat__head">
              {mobile && (
                <Link href="/chat" className={buttonClass('ghost', 'md', true)} aria-label={t('back')}>
                  <Icon name={locale === 'he' ? 'chevronNext' : 'chevron'} />
                </Link>
              )}
              <div>
                <h2 id="chat-title">{title(current)}</h2>
                <span className="t-caption muted">{t('members', { count: current.member_count })}</span>
              </div>
            </header>
            <ChatThread
              key={current.id}
              conversationId={current.id}
              initial={initial.map((m) => ({ ...m, created_at: m.created_at.toISOString() })) as ThreadMessage[]}
              me={{ id: ctx.member.memberId, firstName: ctx.member.firstName, lastName: ctx.member.lastName, avatarColor: ctx.member.avatarColor }}
              timezone={ctx.member.timezone}
              locale={locale}
            />
          </section>
        ) : (
          !mobile && (
            <section className="chat__main">
              <EmptyState title={t('noConversation')} />
            </section>
          )
        )}
      </div>
    </Frame>
  );
}
