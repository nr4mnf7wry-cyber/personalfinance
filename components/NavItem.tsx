"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export type NavItem = {
  href: string;
  label: string;
  subtabs?: { href: string; label: string }[];
};

export default function NavItem({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = item.subtabs ? pathname?.startsWith(item.href) : pathname === item.href;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const linkClass = clsx(
    "text-sm px-1 h-14 flex items-center border-b-2 -mb-px transition-colors gap-1",
    active ? "border-accent text-accent font-medium" : "border-transparent text-gray-500 hover:text-gray-900"
  );

  if (!item.subtabs) {
    return <Link href={item.href} className={linkClass}>{item.label}</Link>;
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className={linkClass}>
        {item.label}
        <span className={clsx("text-xs transition-transform", open && "rotate-180")}>▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-0 z-20 card bg-white shadow-lg py-1 min-w-[180px]">
          {item.subtabs.map((t) => {
            const subActive = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "block px-4 py-2 text-sm",
                  subActive ? "text-accent font-medium bg-[#F5F0E6]" : "text-gray-700 hover:bg-gray-50"
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
