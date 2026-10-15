import { NextResponse, type NextRequest } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { payrollCsv } from '@ritmo/core';
import { currentUser } from '@/server/auth';
import { requireCtx } from '@/server/context';
import { parseWeek, weekSheet } from '@/server/time-queries';

const UUID = /^[0-9a-f-]{36}$/i;

/** Weekly payroll CSV for the people the signed-in manager manages (RLS). */
export async function GET(request: NextRequest) {
  if (!(await currentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const ctx = await requireCtx();
  if (!ctx.isManager) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const ws = parseWeek(params.get('week') ?? undefined);
  const loc = params.get('loc');
  try {
    const rows = await weekSheet(ctx, ws, loc && UUID.test(loc) ? loc : null);
    const t = await getTranslations('time.csv');
    const csv = payrollCsv(
      rows.map((r) => ({
        employeeNo: r.employeeNo,
        name: `${r.firstName} ${r.lastName}`.trim(),
        location: r.location,
        totals: r.totals,
        approved: r.approval === 'approved',
      })),
      {
        employeeNo: t('employeeNo'), name: t('name'), location: t('location'), regular: t('regular'),
        overtime1: t('overtime1'), overtime2: t('overtime2'), restDay: t('restDay'), total: t('total'),
        approved: t('approved'), yes: t('yes'), no: t('no'),
      },
    );
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ritmo-payroll-${ws}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}
