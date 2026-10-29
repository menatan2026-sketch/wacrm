"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@mfg/ui";

/** Section navigation for the partner and ops workspaces; marks the current section. */
export function SurfaceNav({ items, label, base }: { items: { href: string; label: string }[]; label: string; base: string }) {
  const pathname = usePathname();
  const isCurrent = (href: string) => (href === base ? pathname === base : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent(item.href) ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-s px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus",
                isCurrent(item.href) && "bg-primary-subtle text-primary",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
