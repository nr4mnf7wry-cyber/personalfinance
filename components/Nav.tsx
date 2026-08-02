"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import clsx from "clsx";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/input", label: "Saisie" },
  { href: "/investments", label: "Investissements" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-[var(--border)] bg-white">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Budget & Patrimoine</span>
          <div className="flex gap-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "text-sm px-2 py-1 rounded-md",
                  pathname?.startsWith(l.href)
                    ? "bg-blue-50 text-accent font-medium"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          Déconnexion
        </button>
      </div>
    </nav>
  );
}
