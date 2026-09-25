import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VehicleDetail } from "@/components/vehicles/VehicleDetail";
import { repositories } from "@/lib/repositories";

export async function generateStaticParams() {
  const vehicles = await repositories.vehicles.list();
  return vehicles.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata(props: PageProps<"/vehicles/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const v = await repositories.vehicles.getBySlug(slug);
  if (!v) return {};
  return {
    title: `${v.year} ${v.make} ${v.model}`,
    description: `${v.engine.label}, ${v.engine.powerHp} hp, ${v.mileageKm.toLocaleString("en-US")} km — sourced in ${v.location.city}. Estimated landed price in Israel.`,
  };
}

export default async function VehiclePage(props: PageProps<"/vehicles/[slug]">) {
  const { slug } = await props.params;
  const vehicle = await repositories.vehicles.getBySlug(slug);
  if (!vehicle) notFound();
  const related = await repositories.vehicles.related(vehicle, 3);
  return <VehicleDetail vehicle={vehicle} related={related} />;
}
