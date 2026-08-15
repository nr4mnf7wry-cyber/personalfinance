"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export type TabOption = { href: string; label: string; group?: string[] };

export default function TabDropdown({
  tabs,
  variant = "sub",
}: {
  tabs: TabOption[];
  variant?: "sub" | "main";
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const current = tabs.find((t) => (t.group ? t.group.some((g) => pathname?.startsWith(g)) : pathname === t.href))
    ?? tabs[0];

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "flex items-center gap-1.5",
          variant === "main"
            ? "text-sm font-medium text-accent px-2 py-1"
            : "text-sm font-medium text-accent border-b-2 border-accent pb-2 -mb-px"
        )}
      >
        {current.label}
        <span className={clsx("text-xs transition-transform", open && "rotate-180")}>▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 card bg-white shadow-lg py-1 min-w-[180px]">
          {tabs.map((t) => {
            const active = t.href === current.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "block px-4 py-2 text-sm",
                  active ? "text-accent font-medium bg-[#F5F0E6]" : "text-gray-700 hover:bg-gray-50"
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
