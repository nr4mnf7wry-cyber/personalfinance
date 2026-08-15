"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import clsx from "clsx";

// Pages de consultation (regroupées, style onglet classique)
const viewLinks: { href: string; label: string; group?: string[] }[] = [
  { href: "/dashboard", label: "Vue d'ensemble" },
  { href: "/explorer", label: "Explorer" },
  { href: "/patrimoine", label: "Patrimoine" },
  { href: "/projeter", label: "Projeter" },
];

export default function Nav() {
  const pathname = usePathname();
  const onInputPage = pathname?.startsWith("/input");

  return (
    <nav className="border-b border-[var(--border)] bg-white">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Budget & Patrimoine</span>
          <div className="flex gap-4">
            {viewLinks.map((l) => {
              const active = l.group ? l.group.some((g) => pathname?.startsWith(g)) : pathname?.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={clsx(
                    "text-sm px-2 py-1 rounded-md",
                    active
                      ? "bg-[#F5F0E6] text-accent font-medium"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Saisie : volontairement à part — c'est une action, pas une page de consultation */}
          <Link
            href="/input"
            className={clsx(
              "text-sm px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5",
              onInputPage
                ? "bg-accent text-white border-accent"
                : "border-accent text-accent hover:bg-[#F5F0E6]"
            )}
          >
            <span>+</span> Saisie
          </Link>
          <div className="w-px h-5 bg-gray-200" />
          <Link href="/parametres" className="text-sm text-gray-500 hover:text-gray-800">
            Paramètres
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </nav>
  );
}
