import Link from "next/link";
import { footerNav, legalNav, site, whatsappHref } from "@/config/site";
import { vehicleModels } from "@/config/vehicle-models";
import { Instagram, Mail, Phone, WhatsApp } from "@/components/ui/icons";
import { Logo } from "./Logo";
import styles from "./Footer.module.css";

export function Footer() {
  const credits = Object.values(vehicleModels)
    .map((m) => m.credit)
    .filter(Boolean);
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.top}`}>
        <div className={styles.brand}>
          <Logo />
          <p className={styles.statement}>
            Personal vehicle sourcing and import to Israel. We work for the buyer, not a stock list.
          </p>
        </div>

        <nav aria-label="Footer" className={styles.col}>
          <p className="label">Site</p>
          <ul>
            {footerNav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className={styles.link}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.col}>
          <p className="label">Contact</p>
          <ul>
            <li>
              <a className={styles.link} href={whatsappHref()} target="_blank" rel="noreferrer">
                <WhatsApp /> WhatsApp
              </a>
            </li>
            <li>
              <a className={styles.link} href={site.social.instagram} target="_blank" rel="noreferrer">
                <Instagram /> Instagram
              </a>
            </li>
            <li>
              <a className={styles.link} href={`mailto:${site.contact.email}`}>
                <Mail /> {site.contact.email}
              </a>
            </li>
            <li>
              <a className={styles.link} href={`tel:${site.contact.phone.replace(/\s/g, "")}`}>
                <Phone /> {site.contact.phone}
              </a>
            </li>
          </ul>
        </div>

        <div className={styles.col}>
          <p className="label">Office</p>
          <p className={styles.address}>
            {site.contact.address}
            <br />
            {site.contact.hours}
          </p>
        </div>
      </div>

      <div className={`container ${styles.wordmark}`} aria-hidden="true">
        {site.name}
      </div>

      <div className={`container ${styles.bottom}`}>
        <p className="label">
          © {year} {site.legalName}
        </p>
        <ul className={styles.legal}>
          {legalNav.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="label">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className={`label ${styles.disclaimer}`}>
          Prices and landed costs shown are estimates, not offers. Final costs depend on customs valuation, taxes and regulations at
          the time of import.
          {credits.map((c) => (
            <span key={c!.title}>
              {" "}
              3D model: “{c!.title}” by{" "}
              <a href={c!.href} target="_blank" rel="noreferrer">
                {c!.author}
              </a>{" "}
              ({c!.license}).
            </span>
          ))}
        </p>
      </div>
    </footer>
  );
}
