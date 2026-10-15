import 'server-only';
import type { Ctx, Role } from './context';

export interface PersonRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  title: string | null;
  position_id: string | null;
  position_name: string | null;
  primary_location_id: string | null;
  locations: string[] | null;
  location_ids: string[] | null;
  works_on: 'site' | 'computer' | 'both';
  contract_hours_week: string | null;
  avatar_color: 'green' | 'sun' | 'sky' | 'clay' | 'stone';
  has_login: boolean;
  invited: boolean;
  rate_minor: bigint | null;
  can_manage: boolean;
}

export async function people(ctx: Ctx, q: string | null, locationId: string | null): Promise<PersonRow[]> {
  const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
  return ctx.db((tx) => tx<PersonRow[]>`
    select m.id, m.first_name, m.last_name, m.email, m.phone, m.role, m.title, m.position_id, p.name as position_name,
           m.primary_location_id, m.works_on, m.contract_hours_week::text as contract_hours_week, m.avatar_color,
           m.user_id is not null as has_login,
           exists (select 1 from ritmo.invitations i where i.member_id = m.id and i.accepted_at is null and i.expires_at > now()) as invited,
           (select array_agg(l.name order by l.sort_order) from ritmo.member_locations ml join ritmo.locations l on l.id = ml.location_id
             where ml.member_id = m.id) as locations,
           (select array_agg(ml.location_id) from ritmo.member_locations ml where ml.member_id = m.id) as location_ids,
           mp.hourly_rate_minor as rate_minor,
           ritmo.can_manage_member(m.org_id, m.id) as can_manage
    from ritmo.members m
    left join ritmo.positions p on p.id = m.position_id
    left join ritmo.member_pay mp on mp.member_id = m.id
    where m.org_id = ${ctx.member.orgId} and m.status <> 'inactive'
      ${like ? tx`and (m.first_name || ' ' || m.last_name) ilike ${like}` : tx``}
      ${locationId ? tx`and exists (select 1 from ritmo.member_locations ml where ml.member_id = m.id and ml.location_id = ${locationId})` : tx``}
    order by m.first_name, m.last_name`);
}

export async function positions(ctx: Ctx) {
  return ctx.db((tx) => tx<{ id: string; name: string }[]>`
    select id, name from ritmo.positions where org_id = ${ctx.member.orgId} order by sort_order, name`);
}

export interface AuditRow {
  id: string;
  created_at: Date;
  action: string;
  target_type: string | null;
  actor: string | null;
  details: Record<string, unknown>;
}

/** Latest audit entries; RLS shows them to owners and admins only. */
export async function auditLog(ctx: Ctx, limit = 50): Promise<AuditRow[]> {
  return ctx.db((tx) => tx<AuditRow[]>`
    select a.id::text as id, a.created_at, a.action, a.target_type, a.details,
           nullif(trim(coalesce(m.first_name, '') || ' ' || coalesce(m.last_name, '')), '') as actor
    from ritmo.audit_log a left join ritmo.members m on m.id = a.actor_member_id
    where a.org_id = ${ctx.member.orgId}
    order by a.created_at desc limit ${limit}`);
}
