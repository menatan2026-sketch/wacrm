"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import s from "./StickyRequestBar.module.css";

/** Appears once the hero has scrolled away; hides again at the request form. */
export function StickyRequestBar({ title, price }: { title: string; price: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const form = document.getElementById("request");
      const atForm = form ? form.getBoundingClientRect().top < window.innerHeight * 0.8 : false;
      setShow(window.scrollY > window.innerHeight * 0.9 && !atForm);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className={s.bar} data-show={show} aria-hidden={!show}>
      <div className={`container ${s.inner}`}>
        <div className={s.text}>
          <span className={s.title}>{title}</span>
          <span className={s.price}>
            <span className="label">Est. landed</span> <span className="num">{price}</span>
          </span>
        </div>
        <Link href="#request" className="btn btn-primary btn-sm" tabIndex={show ? 0 : -1}>
          Request this vehicle
        </Link>
      </div>
    </div>
  );
}
