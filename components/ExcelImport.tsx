"use client";

import { useState } from "react";
import { GROUP_LABELS, Group } from "@/lib/categories";

type ParsedLine = { year: number; month: number; group: Group; category: string; amount: number };
type ParsedMonth = { year: number; month: number; lines: ParsedLine[] };
type ParsedCategory = { name: string; group: Group };

const MONTH_LABELS_SHORT = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];
const GROUPS: Group[] = ["revenus", "fixes", "variables", "epargne"];

export default function ExcelImport({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ monthCount: number; lineCount: number; categories: ParsedCategory[]; months: ParsedMonth[] } | null>(null);
  const [groupOverrides, setGroupOverrides] = useState<Record<string, Group>>({});
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/import-excel", { method: "POST", body: form });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'analyse du fichier");
      return;
    }
    setResult(data);
    setGroupOverrides(Object.fromEntries(data.categories.map((c: ParsedCategory) => [c.name, c.group])));
    setOpen(true);
  }

  async function confirmImport() {
    if (!result) return;
    setConfirming(true);
    setProgress(0);

    // 1. Crée les catégories avec le groupe (éventuellement corrigé par l'utilisateur)
    for (const cat of result.categories) {
      await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group: groupOverrides[cat.name] ?? cat.group, name: cat.name }),
      }).catch(() => {}); // ignore si elle existe déjà (409)
    }

    // 2. Envoie chaque mois avec le groupe corrigé appliqué à chaque ligne
    for (let i = 0; i < result.months.length; i++) {
      const m = result.months[i];
      const lines = m.lines.map((l) => ({
        group: groupOverrides[l.category] ?? l.group,
        category: l.category,
        subCategory: null,
        amount: l.amount,
      }));
      await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: m.year, month: m.month, lines }),
      });
      setProgress(i + 1);
    }

    setConfirming(false);
    setOpen(false);
    setResult(null);
    onImported();
  }

  return (
    <div>
      <label className="text-sm border border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
        {loading ? "Analyse..." : "📥 Importer un Excel"}
        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
      </label>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {open && result && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card bg-white max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">
                Aperçu de l'import — {result.monthCount} mois détectés ({result.lineCount} valeurs)
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Vérifie le groupe de chaque catégorie ci-dessous avant de confirmer — certains ont été devinés automatiquement
                (pas de section "Income"/"Fixed expenses" trouvée dans ton fichier pour les guider).
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Catégories détectées</p>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {result.categories.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm text-gray-700">{cat.name}</span>
                    <select
                      value={groupOverrides[cat.name] ?? cat.group}
                      onChange={(e) => setGroupOverrides((o) => ({ ...o, [cat.name]: e.target.value as Group }))}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                    >
                      {GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              {result.months.map((m) => (
                <div key={`${m.year}-${m.month}`} className="border border-gray-200 rounded-lg p-3">
                  <div className="font-medium mb-1">{MONTH_LABELS_SHORT[m.month - 1]} {m.year}</div>
                  <div className="text-gray-500">{m.lines.length} valeurs</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 justify-end pt-2">
              {confirming && (
                <span className="text-sm text-gray-500">
                  Import {progress}/{result.months.length}...
                </span>
              )}
              <button
                onClick={() => { setOpen(false); setResult(null); }}
                disabled={confirming}
                className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmImport}
                disabled={confirming}
                className="px-4 py-2 rounded-lg bg-accent text-white disabled:opacity-50"
              >
                {confirming ? "Import en cours..." : `Confirmer l'import (${result.monthCount} mois)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
