import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { asUser } from '@ritmo/db';
import { currentUser } from '@/server/auth';
import { ORG_COOKIE } from '@/server/context';

/**
 * "Download my data": every row about the signed-in person in their active
 * organization, read under Row-Level Security as that person.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const preferred = (await cookies()).get(ORG_COOKIE)?.value ?? null;

  try {
    const data = await asUser(user.id, async (tx) => {
      const [member] = await tx<{ id: string; org_id: string }[]>`
        select id, org_id from ritmo.members
        where user_id = ${user.id} and status = 'active'
        order by (org_id = ${preferred}::uuid) desc nulls last, created_at
        limit 1`;
      if (!member) return null;
      const me = member.id;
      const [profile, pay, shifts, requests, events, entries, anomalies, activity] = await Promise.all([
        tx`select first_name, last_name, email, phone, role, title, works_on, contract_hours_week, created_at
           from ritmo.members where id = ${me}`,
        tx`select hourly_rate_minor::text as hourly_rate_minor, updated_at from ritmo.member_pay where member_id = ${me}`,
        tx`select starts_at, ends_at, break_minutes, status from ritmo.shifts where member_id = ${me} order by starts_at`,
        tx`select kind, status, created_at, decided_at from ritmo.shift_requests where requester_member_id = ${me} order by created_at`,
        tx`select type, occurred_at, source, lat, lng, accuracy_m, distance_m, inside_geofence
           from ritmo.time_events where member_id = ${me} order by occurred_at`,
        tx`select work_date::text as work_date, started_at, ended_at, break_minutes, edited_reason
           from ritmo.time_entries where member_id = ${me} order by started_at`,
        tx`select kind, details, status, created_at from ritmo.anomalies where member_id = ${me} order by created_at`,
        tx`select started_at, ended_at, kind, app from ritmo.activity_segments where member_id = ${me} order by started_at`,
      ]);
      return { exportedAt: new Date().toISOString(), profile: profile[0], pay: pay[0] ?? null, shifts, requests, timeEvents: events, timeEntries: entries, anomalies, activity };
    });
    if (!data) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="ritmo-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}
