"use client";

import { useEffect, useState } from "react";
import CategoryManager from "@/components/settings/CategoryManager";

export default function SettingsPage() {
  const [currency, setCurrency] = useState("EUR");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => setCurrency(d.user?.currency ?? "EUR"));
  }, []);

  async function saveCurrency() {
    await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Paramètres</h1>

      <div className="card">
        <h3 className="mb-3 font-semibold">Devise</h3>
        <div className="flex items-center gap-2">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="GBP">GBP (£)</option>
            <option value="CHF">CHF</option>
          </select>
          <button
            onClick={saveCurrency}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white"
          >
            Enregistrer
          </button>
          {saved && <span className="text-sm text-income">Enregistré ✓</span>}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-2 font-semibold">Export des données</h3>
        <p className="mb-3 text-sm text-slate-500">
          Télécharge toutes tes données (revenus, dépenses, soldes de départ) dans un
          fichier Excel — au même format que l&apos;import, donc réimportable tel quel.
        </p>
        <a
          href="/api/export"
          className="inline-block rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Télécharger l&apos;export Excel
        </a>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Catégories
        </h2>
        <CategoryManager />
      </div>
    </div>
  );
}
