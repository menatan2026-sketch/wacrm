import { redirect } from 'next/navigation';
import { requireCtx } from '@/server/context';

export default async function Home() {
  const ctx = await requireCtx();
  redirect(ctx.isManager ? '/overview' : '/me');
}
