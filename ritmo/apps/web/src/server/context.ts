import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { asUser, type Tx } from '@ritmo/db';
import { resolvePolicy, type AttendancePolicy } from '@ritmo/core';
import { currentUser, type SessionUser } from './auth';

export const ORG_COOKIE = 'ritmo_org';

export type Role = 'owner' | 'admin' | 'manager' | 'employee';

export interface Membership {
  orgId: string;
  orgName: string;
  memberId: string;
  role: Role;
  firstName: string;
  lastName: string;
  title: string | null;
  avatarColor: 'green' | 'sun' | 'sky' | 'clay' | 'stone';
  worksOn: 'site' | 'computer' | 'both';
  timezone: string;
  isDemo: boolean;
  policy: AttendancePolicy;
}

export interface Ctx {
  user: SessionUser;
  member: Membership;
  memberships: Membership[];
  isManager: boolean;
  /** Run queries as this user, under Row-Level Security. */
  db: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;
}

export function isManagerRole(role: Role) {
  return role === 'owner' || role === 'admin' || role === 'manager';
}

/** Signed-in user + active organization, or redirect to sign-in. */
export const requireCtx = cache(async (): Promise<Ctx> => {
  const user = await currentUser();
  if (!user) redirect('/login');

  const rows = await asUser(user.id, async (tx) => {
    const r = await tx<
      {
        org_id: string; org_name: string; member_id: string; role: Role; first_name: string; last_name: string;
        title: string | null; avatar_color: Membership['avatarColor']; works_on: Membership['worksOn']; timezone: string; is_demo: boolean; attendance_policy: unknown;
      }[]
    >`select o.id as org_id, o.name as org_name, m.id as member_id, m.role, m.first_name, m.last_name, m.title,
             m.avatar_color, m.works_on, o.timezone, o.is_demo, o.attendance_policy
      from ritmo.members m join ritmo.organizations o on o.id = m.org_id
      where m.user_id = ${user.id} and m.status = 'active'
      order by o.created_at`;
    return r;
  });

  const memberships: Membership[] = rows.map((r) => ({
    orgId: r.org_id,
    orgName: r.org_name,
    memberId: r.member_id,
    role: r.role,
    firstName: r.first_name,
    lastName: r.last_name,
    title: r.title,
    avatarColor: r.avatar_color,
    worksOn: r.works_on,
    timezone: r.timezone,
    isDemo: r.is_demo,
    policy: resolvePolicy(r.attendance_policy),
  }));
  if (memberships.length === 0) redirect('/signup?step=org');

  const preferred = (await cookies()).get(ORG_COOKIE)?.value;
  const member = memberships.find((m) => m.orgId === preferred) ?? memberships[0]!;

  const db = <T,>(fn: (tx: Tx) => Promise<T>) => asUser(user.id, fn);

  // The demo company simulates its day as people use it.
  if (member.isDemo) {
    await db((tx) => tx`select ritmo.demo_refresh(${member.orgId})`);
  }

  return { user, member, memberships, isManager: isManagerRole(member.role), db };
});

/** Pages for managers only; employees land on their own app. */
export async function requireManager(): Promise<Ctx> {
  const ctx = await requireCtx();
  if (!ctx.isManager) redirect('/me');
  return ctx;
}
