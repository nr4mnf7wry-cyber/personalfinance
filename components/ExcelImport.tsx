"use client";

import { useState } from "react";

export default function ExcelImport({ year, onImported }: { year: number; onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/import-excel", { method: "POST", body: form });
    const data = await res.json();
    setLoading(false);
    setPreview(data);
    setOpen(true);
  }

  async function confirmImport() {
    if (!preview) return;
    setConfirming(true);

    // Regroupe les lignes de l'aperçu par mois puis pousse via /api/entries
    for (const row of preview.preview) {
      const monthNum = parseMonthLabel(row.monthLabel);
      if (!monthNum) continue;
      const lines = row.lines
        .filter((l: any) => l.matchedCategory)
        .map((l: any) => ({
          group: l.group,
          category: l.matchedCategory,
          subCategory: null,
          amount: Number(l.value) || 0,
        }));
      if (lines.length === 0) continue;
      await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month: monthNum, lines }),
      });
    }

    setConfirming(false);
    setOpen(false);
    setPreview(null);
    onImported();
  }

  return (
    <div>
      <label className="text-sm border border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
        {loading ? "Analyse..." : "📥 Importer un Excel"}
        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
      </label>

      {open && preview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card bg-white max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-semibold">Aperçu de l'import ({preview.rowCount} lignes)</h2>

            {preview.unmatchedColumns?.length > 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                Colonnes non reconnues (ignorées) : {preview.unmatchedColumns.join(", ")}
              </p>
            )}

            <div className="space-y-3 text-sm">
              {preview.preview.map((row: any, i: number) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3">
                  <div className="font-medium mb-1">{row.monthLabel ?? `Ligne ${i + 1}`}</div>
                  <div className="grid grid-cols-2 gap-1">
                    {row.lines.filter((l: any) => l.matchedCategory).map((l: any) => (
                      <div key={l.column} className="flex justify-between text-gray-600">
                        <span>{l.matchedCategory}</span>
                        <span>{l.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => { setOpen(false); setPreview(null); }}
                className="px-4 py-2 rounded-lg border border-gray-300"
              >
                Annuler
              </button>
              <button
                onClick={confirmImport}
                disabled={confirming}
                className="px-4 py-2 rounded-lg bg-accent text-white disabled:opacity-50"
              >
                {confirming ? "Import..." : "Confirmer l'import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseMonthLabel(label: any): number | null {
  if (!label) return null;
  const s = label.toString().toLowerCase();
  const months = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  const idx = months.findIndex((m) => s.includes(m));
  if (idx >= 0) return idx + 1;
  const num = Number(s);
  if (num >= 1 && num <= 12) return num;
  return null;
}
