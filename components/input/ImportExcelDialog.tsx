"use client";

import { useRef, useState } from "react";

export default function ImportExcelDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    entriesSaved: number;
    balancesSaved: number;
    categoriesCreated: number;
    errors: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/entries/import", { method: "POST", body: form });
    const data = await res.json();
    setBusy(false);
    setResult(data);
    if (res.ok) onImported();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Importer un Excel
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
            Format attendu : feuille <code>Entries</code> (Année, Mois, Groupe,
            Catégorie, Montant) et <code>StartingBalance</code> optionnelle.
          </p>
          <a
            href="/api/entries/import"
            className="mb-3 inline-block text-sm text-brand-600 underline"
          >
            Télécharger le modèle vierge
          </a>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="mb-3 w-full text-sm"
          />
          <button
            onClick={handleImport}
            disabled={busy}
            className="w-full rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Import en cours..." : "Importer"}
          </button>
          {result && (
            <div className="mt-3 max-h-40 overflow-auto text-xs">
              <p className="font-medium text-income">
                {result.entriesSaved} lignes importées, {result.categoriesCreated}{" "}
                nouvelle(s) catégorie(s), {result.balancesSaved} solde(s) de départ.
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-expense">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
