"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { whatsappHref } from "@/config/site";
import { WhatsApp } from "@/components/ui/icons";
import s from "./FloatingWhatsApp.module.css";

/** Always-within-reach WhatsApp button, shown once the visitor starts scrolling. */
export function FloatingWhatsApp() {
  const [show, setShow] = useState(false);
  const path = usePathname();
  useEffect(() => {
    const on = () => setShow(window.scrollY > window.innerHeight * 0.6);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  if (path === "/request") return null;
  return (
    <a
      className={s.fab}
      data-show={show}
      href={whatsappHref("Hi — I'd like to talk about importing a car.")}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with a specialist on WhatsApp"
      data-cursor="open"
    >
      <WhatsApp width={22} height={22} />
      <span className={s.text}>Talk to a specialist</span>
    </a>
  );
}
