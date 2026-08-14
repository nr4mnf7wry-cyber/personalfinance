"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const tabs = [
  { href: "/dashboard", label: "Général" },
  { href: "/dashboard/analyse", label: "Analyse" },
  { href: "/dashboard/simulateur", label: "Simulateur" },
];

export default function DashboardTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-[var(--border)] mb-8">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px",
              active ? "border-accent text-accent" : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
