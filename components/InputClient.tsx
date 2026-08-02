"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, GROUP_LABELS, Group, MONTH_LABELS, ALL_CATEGORIES } from "@/lib/categories";
import { Money } from "@/components/BlurToggle";
import ExcelImport from "@/components/ExcelImport";
import HistoryTable from "@/components/HistoryTable";

type EntryLine = { group: Group; category: string; subCategory: string | null; amount: number };

const now = new Date();

export default function InputClient() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [detailed, setDetailed] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [investTicker, setInvestTicker] = useState("");
  const [investQty, setInvestQty] = useState<number | "">("");
  const [investPrice, setInvestPrice] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [allEntries, setAllEntries] = useState<any[]>([]);

  // Charge l'historique complet (pour le tableau + pré-remplissage mois précédent)
  useEffect(() => {
    fetch(`/api/entries?year=${year}`)
      .then((r) => r.json())
      .then((data) => setAllEntries((prev) => mergeByYear(prev, year, data)));
  }, [year]);

  useEffect(() => {
    // pré-remplit avec le mois précédent (même année ou année-1 si janvier)
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;

    fetch(`/api/entries?year=${prevYear}&month=${prevMonth}`)
      .then((r) => r.json())
      .then((prevData: any[]) => {
        const map: Record<string, number> = {};
        for (const c of ALL_CATEGORIES) {
          const key = `${c.category}`;
          const found = prevData.find((e) => e.category === c.category && !e.subCategory);
          map[key] = found?.amount ?? 0;
        }
        setAmounts(map);
      });
  }, [year, month]);

  function mergeByYear(prev: any[], y: number, data: any[]) {
    const withoutYear = prev.filter((e) => e.year !== y);
    return [...withoutYear, ...data];
  }

  async function handleSubmit() {
    setSaving(true);
    setSavedMsg(null);

    const lines: any[] = ALL_CATEGORIES.map((c) => ({
      group: c.group,
      category: c.category,
      subCategory: null,
      amount: amounts[c.category] ?? 0,
      ...(c.category === "Investissement" && investTicker && investQty && investPrice
        ? {
            investment: {
              ticker: investTicker,
              quantity: Number(investQty),
              unitPrice: Number(investPrice),
            },
          }
        : {}),
    }));

    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, lines }),
    });

    setSaving(false);
    if (res.ok) {
      setSavedMsg("Mois enregistré ✅");
      fetch(`/api/entries?year=${year}`)
        .then((r) => r.json())
        .then((data) => setAllEntries((prev) => mergeByYear(prev, year, data)));
    } else {
      setSavedMsg("Erreur lors de l'enregistrement");
    }
  }

  const totals = useMemo(() => {
    const t: Record<Group, number> = { revenus: 0, fixes: 0, variables: 0, epargne: 0 };
    for (const c of ALL_CATEGORIES) {
      t[c.group] += amounts[c.category] ?? 0;
    }
    return t;
  }, [amounts]);

  return (
    <div className="space-y-10">
      {/* Sélecteurs + options */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2"
        >
          {MONTH_LABELS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 w-24"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700 ml-4">
          <input type="checkbox" checked={detailed} onChange={() => setDetailed((d) => !d)} />
          Vue détaillée (poste par poste)
        </label>
        <div className="ml-auto">
          <ExcelImport year={year} onImported={() => setAmounts({ ...amounts })} />
        </div>
      </div>

      {/* Formulaire */}
      <div className="card p-6 space-y-6">
        {!detailed ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(Object.keys(GROUP_LABELS) as Group[]).map((g) => (
              <div key={g} className="space-y-1">
                <div className="text-sm text-gray-500">{GROUP_LABELS[g]}</div>
                <div className="text-lg font-semibold"><Money value={totals[g]} /></div>
              </div>
            ))}
          </div>
        ) : (
          (Object.keys(CATEGORIES) as Group[]).map((g) => (
            <div key={g}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                {GROUP_LABELS[g]}
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                {CATEGORIES[g].map(({ category }) => (
                  <div key={category} className="flex items-center justify-between gap-3">
                    <label className="text-sm text-gray-700">{category}</label>
                    <input
                      type="number"
                      value={amounts[category] ?? 0}
                      onChange={(e) =>
                        setAmounts((a) => ({ ...a, [category]: Number(e.target.value) }))
                      }
                      className="border border-gray-300 rounded-lg px-3 py-1.5 w-32 text-right"
                    />
                  </div>
                ))}
              </div>

              {g === "epargne" && (amounts["Investissement"] ?? 0) > 0 && (
                <div className="mt-3 p-4 bg-purple-50 rounded-lg space-y-2">
                  <p className="text-sm text-purple-800">
                    Préciser le titre acheté pour tracer ce montant dans Investissements :
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <input
                      placeholder="Ticker (ex: MSFT)"
                      value={investTicker}
                      onChange={(e) => setInvestTicker(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 w-40"
                    />
                    <input
                      type="number"
                      placeholder="Quantité"
                      value={investQty}
                      onChange={(e) => setInvestQty(e.target.value ? Number(e.target.value) : "")}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 w-32"
                    />
                    <input
                      type="number"
                      placeholder="Prix unitaire"
                      value={investPrice}
                      onChange={(e) => setInvestPrice(e.target.value ? Number(e.target.value) : "")}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 w-32"
                    />
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-accent text-white rounded-lg px-5 py-2 font-medium disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer le mois"}
          </button>
          {savedMsg && <span className="text-sm text-gray-600">{savedMsg}</span>}
        </div>
      </div>

      {/* Historique */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Historique</h2>
        <HistoryTable entries={allEntries} />
      </div>
    </div>
  );
}
