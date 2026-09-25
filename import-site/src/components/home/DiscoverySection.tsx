import Link from "next/link";
import type { Vehicle } from "@/domain/types";
import { RevealText } from "@/components/ui/RevealText";
import { SmartQuery } from "@/components/vehicles/SmartQuery";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import c from "./chapter.module.css";
import s from "./DiscoverySection.module.css";

/** Discovery — tell us the car in your own words, or browse what's sourced now. */
export function DiscoverySection({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <section className={`${c.plate} ${c.sectionPad}`} aria-labelledby="discover-title">
      <div className="container">
        <div className={c.sectionHead}>
          <div className={s.titleWrap}>
            <p className={c.index}>Discovery</p>
            <RevealText id="discover-title" className="display-m" lines={["Describe it.", "We'll find it."]} />
          </div>
          <p className="body-l">Type the car the way you&apos;d say it. We turn it into a search across seven markets.</p>
        </div>

        <div className={s.query}>
          <SmartQuery />
        </div>

        <div className={s.railHead}>
          <p className="label label-strong">Sourced this month</p>
          <Link href="/vehicles" className="link" data-cursor="explore">
            Explore all vehicles
          </Link>
        </div>
        <div className={s.rail}>
          {vehicles.map((v, i) => (
            <VehicleCard key={v.id} vehicle={v} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
