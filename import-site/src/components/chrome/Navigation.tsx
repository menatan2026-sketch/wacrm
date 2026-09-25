"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { primaryNav, site, whatsappHref } from "@/config/site";
import { ArrowRight } from "@/components/ui/icons";
import { Magnetic } from "@/components/ui/Magnetic";
import { Logo } from "./Logo";
import { useLenis } from "./SmoothScroll";
import styles from "./Navigation.module.css";

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const lastY = useRef(0);
  const pathname = usePathname();
  const lenis = useLenis();

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      // Hide while travelling down the story, return on any upward intent.
      if (y > 480 && y > lastY.current + 6) setHidden(true);
      else if (y < lastY.current - 6 || y < 480) setHidden(false);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menu on navigation; lock scroll while it's open.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route change closes the overlay
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (open) lenis?.stop();
    else lenis?.start();
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, lenis]);

  return (
    <>
      <header
        className={styles.header}
        data-scrolled={scrolled || open}
        data-hidden={hidden && !open}
        data-open={open}
      >
        <div className={styles.inner}>
          <Link href="/" className={styles.logo} aria-label={`${site.name} — home`}>
            <Logo />
          </Link>

          <nav className={styles.nav} aria-label="Primary">
            <ul>
              {primaryNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={styles.navLink}
                    aria-current={pathname === item.href ? "page" : undefined}
                  >
                    <span data-text={item.label}>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.actions}>
            <Magnetic strength={0.25}>
              <Link href="/request" className={`btn btn-primary btn-sm ${styles.cta}`} data-cursor="open">
                Get a quote
              </Link>
            </Magnetic>
            <button
              type="button"
              className={styles.burger}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
            >
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <div id="mobile-menu" className={styles.menu} data-open={open} aria-hidden={!open}>
        <div className={styles.menuInner}>
          <p className="label">Menu</p>
          <ul className={styles.menuList}>
            {primaryNav.map((item, i) => (
              <li key={item.href} style={{ "--i": i } as React.CSSProperties}>
                <Link href={item.href} tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>
                  <span className={styles.menuIndex}>{String(i + 1).padStart(2, "0")}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className={styles.menuFoot}>
            <Link href="/request" className="btn btn-primary" tabIndex={open ? 0 : -1}>
              Get a free quote <ArrowRight className="btn-arrow" />
            </Link>
            <a href={whatsappHref()} className="link" target="_blank" rel="noreferrer" tabIndex={open ? 0 : -1}>
              WhatsApp an import specialist
            </a>
            <p className="label">
              {site.contact.phone} · {site.contact.hours}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
