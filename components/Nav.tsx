"use client";

import { useEffect, useState } from "react";
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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/admin/is-admin").then((r) => r.json()).then((d) => setIsAdmin(!!d.isAdmin)).catch(() => {});
  }, []);

  return (
    <nav className="bg-white shadow-[0_1px_3px_rgba(18,35,63,0.06)] relative z-10">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="font-semibold flex items-center gap-2 tracking-tight">
            <span className="w-2 h-2 rounded-full bg-accent inline-block" />
            Budget & Patrimoine
          </span>
          <div className="flex gap-1 h-16 items-stretch">
            {viewLinks.map((l) => {
              const active = l.group ? l.group.some((g) => pathname?.startsWith(g)) : pathname?.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={clsx(
                    "text-sm px-1 flex items-center border-b-2 -mb-px transition-colors",
                    active
                      ? "border-accent text-accent font-medium"
                      : "border-transparent text-gray-500 hover:text-gray-900"
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
              "text-sm px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors",
              onInputPage
                ? "bg-accent text-white border-accent"
                : "border-accent text-accent hover:bg-[#F5F0E6]"
            )}
          >
            <span>+</span> Saisie
          </Link>
          <div className="w-px h-5 bg-gray-200" />
          {isAdmin && (
            <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-800">
              Admin
            </Link>
          )}
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
