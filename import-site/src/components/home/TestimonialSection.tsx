import Image from "next/image";
import type { Testimonial } from "@/domain/types";
import { getMarket } from "@/data/markets";
import { DESTINATION } from "@/data/markets";
import { distanceKm } from "@/lib/geo";
import { Reveal, RevealText } from "@/components/ui/RevealText";
import { RouteArt } from "./RouteArt";
import c from "./chapter.module.css";
import s from "./TestimonialSection.module.css";

/**
 * Delivered — client case files. Entries flagged `isSample` render as
 * illustrative layouts with no quotes; real stories (with consent) drop
 * straight into the same slots, photography included.
 */
export function TestimonialSection({ items }: { items: Testimonial[] }) {
  return (
    <section className={`${c.plate} ${c.sectionPad}`} aria-labelledby="delivered-title">
      <div className="container">
        <div className={c.sectionHead}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <p className={c.index}>Delivered</p>
            <RevealText id="delivered-title" className="display-m" lines={["Every route", "ends in a driveway."]} />
          </div>
          <p className="body-l">
            Client stories are published only with their permission. Until then, these case-file layouts show the shape of the
            journey — never invented quotes.
          </p>
        </div>

        <div className={s.list}>
          {items.map((t, i) => {
            const market = getMarket(t.origin.countryCode);
            const from = { lat: t.origin.lat ?? market?.lat ?? 0, lng: t.origin.lng ?? market?.lng ?? 0 };
            const km = Math.round(distanceKm([from.lat, from.lng], [DESTINATION.lat, DESTINATION.lng]) / 10) * 10;
            return (
              <Reveal as="article" key={t.id} className={s.item} threshold={0.2}>
                <div className={s.media}>
                  {t.image ? (
                    <Image src={t.image.src} alt={t.image.alt} fill sizes="(max-width: 900px) 100vw, 60vw" style={{ objectFit: "cover" }} />
                  ) : (
                    <RouteArt className={s.art} from={from} label={t.origin.city} destinationLabel={t.destination} />
                  )}
                  {t.isSample && <span className={s.sample}>Illustrative case file</span>}
                </div>
                <div className={s.meta}>
                  <span className={s.num}>{String(i + 1).padStart(2, "0")}</span>
                  <h3 className={s.headline}>
                    From {market?.name.replace("United States", "the USA").replace("United Arab Emirates", "the UAE").replace("United Kingdom", "the UK") ?? t.origin.city}
                    <br />
                    to {t.destination}.
                  </h3>
                  <p className={s.vehicle}>{t.vehicle}</p>
                  {t.quote && <blockquote className={s.quote}>“{t.quote}”</blockquote>}
                  <dl className={s.facts}>
                    <div>
                      <dt className="label">Customer</dt>
                      <dd>{t.customer}</dd>
                    </div>
                    <div>
                      <dt className="label">Import origin</dt>
                      <dd>
                        {t.origin.city}, {t.origin.countryCode}
                      </dd>
                    </div>
                    <div>
                      <dt className="label">Delivered to</dt>
                      <dd>{t.destination}</dd>
                    </div>
                    <div>
                      <dt className="label">Route</dt>
                      <dd className="num">≈ {km.toLocaleString("en-US")} km</dd>
                    </div>
                  </dl>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
