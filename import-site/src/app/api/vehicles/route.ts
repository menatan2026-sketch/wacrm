import { NextResponse } from "next/server";
import type { SortKey } from "@/domain/types";
import { paramsToCriteria } from "@/lib/search/filter";
import { repositories } from "@/lib/repositories";

/**
 * Read-only inventory search — the same criteria the UI uses, for
 * integrations (WhatsApp bots, CRM automations) and for when the
 * inventory outgrows client-side filtering.
 *   GET /api/vehicles?make=Porsche&budgetMaxILS=2000000&sort=price-asc
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const criteria = paramsToCriteria(url.searchParams);
  const sort = (url.searchParams.get("sort") ?? "recommended") as SortKey;
  const results = await repositories.vehicles.search(criteria, sort);
  return NextResponse.json({
    data: results.map((r) => r.vehicle),
    meta: { count: results.length, criteria },
  });
}
