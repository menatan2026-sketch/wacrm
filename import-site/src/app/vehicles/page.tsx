import type { Metadata } from "next";
import { PageHeader } from "@/components/page/PageHeader";
import { SearchInterface } from "@/components/vehicles/SearchInterface";
import type { SortKey } from "@/domain/types";
import { paramsToCriteria } from "@/lib/search/filter";
import { repositories } from "@/lib/repositories";
import s from "./page.module.css";

export const metadata: Metadata = {
  title: "Find your car",
  description: "Luxury, performance, electric and rare vehicles sourced from Germany, Italy, the UK, the USA, the UAE, Japan and Korea — with estimated landed prices in Israel.",
};

const SORTS: SortKey[] = ["recommended", "price-asc", "price-desc", "year-desc", "mileage-asc"];

export default async function VehiclesPage(props: PageProps<"/vehicles">) {
  const params = await props.searchParams;
  const vehicles = await repositories.vehicles.list();
  const initial = paramsToCriteria(params);
  const sortParam = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  const intent = Array.isArray(params.intent) ? params.intent[0] : params.intent;

  return (
    <div className={s.page}>
      <PageHeader
        index="Find your car"
        title={["The exact car.", "Anywhere."]}
        lede="Search what we've already located, or describe what you want in your own words. Every price is an estimated landed cost in Israel."
      />
      <div className="container">
        <SearchInterface
          vehicles={vehicles}
          initial={initial}
          initialQuery={q ?? ""}
          initialSort={SORTS.includes(sortParam as SortKey) ? (sortParam as SortKey) : "recommended"}
          focusQuery={intent === "find"}
        />
      </div>
    </div>
  );
}
