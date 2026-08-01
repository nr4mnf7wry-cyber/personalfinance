"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import clsx from "clsx";
import { useBlur } from "@/components/BlurProvider";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/input", label: "Saisie" },
  { href: "/investments", label: "Investissements" },
  { href: "/settings", label: "Paramètres" },
];

export default function Nav() {
  const pathname = usePathname();
  const { blurred, toggle } = useBlur();

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Mes Finances</span>
          <nav className="flex gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  pathname?.startsWith(link.href)
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            title="Flouter/afficher les montants"
            className={clsx(
              "rounded-lg border px-3 py-1.5 text-sm font-medium",
              blurred
                ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
            )}
          >
            {blurred ? "🙈 Chiffres masqués" : "👁 Afficher/masquer"}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </header>
  );
}
