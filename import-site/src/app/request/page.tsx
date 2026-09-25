import type { Metadata } from "next";
import { ContactForm } from "@/components/forms/ContactForm";
import { PageHeader } from "@/components/page/PageHeader";
import { site, whatsappHref } from "@/config/site";
import { WhatsApp, Phone, Mail } from "@/components/ui/icons";
import { repositories } from "@/lib/repositories";
import s from "./page.module.css";

export const metadata: Metadata = {
  title: "Start your import",
  description: "Tell us exactly what you're looking for. We'll search international markets and build the route to your driveway.",
};

export default async function RequestPage(props: PageProps<"/request">) {
  const q = await props.searchParams;
  const one = (k: string) => {
    const v = q[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const vehicle = one("vehicle") ? await repositories.vehicles.getBySlug(one("vehicle")!) : null;
  const budget = one("budget");

  return (
    <div className={s.page}>
      <PageHeader
        index={vehicle ? "Request this vehicle" : "We find it for you"}
        title={vehicle ? [`${vehicle.year} ${vehicle.make}`, vehicle.model] : ["Can't find", "the right car?"]}
        lede={
          vehicle
            ? "Leave your details and a specialist will confirm availability, the latest landed-cost estimate and next steps."
            : "Tell us exactly what you're looking for. We'll search international markets and build the route to your driveway."
        }
      />
      <div className={`container ${s.grid}`}>
        <ContactForm
          source={vehicle ? "vehicle-request" : one("source") === "calculator" ? "calculator" : one("service") ? "specialist" : "sourcing-request"}
          vehicleSlug={vehicle?.slug}
          vehicleLabel={vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : undefined}
          mode={vehicle ? "vehicle" : "full"}
          prefill={{
            make: one("make"),
            model: one("model"),
            color: one("color"),
            budget: budget ? `₪${Number(budget).toLocaleString("en-US")}` : undefined,
          }}
        />
        <aside className={s.aside}>
          <p className="label label-strong">Prefer to talk?</p>
          <a href={whatsappHref()} target="_blank" rel="noreferrer" className={s.channel}>
            <WhatsApp /> <span>WhatsApp</span>
          </a>
          <a href={`tel:${site.contact.phone.replace(/\s/g, "")}`} className={s.channel}>
            <Phone /> <span>{site.contact.phone}</span>
          </a>
          <a href={`mailto:${site.contact.email}`} className={s.channel}>
            <Mail /> <span>{site.contact.email}</span>
          </a>
          <p className="label">{site.contact.hours}</p>
        </aside>
      </div>
    </div>
  );
}
