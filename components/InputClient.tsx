"use client";

import { useEffect, useMemo, useState } from "react";
import { GROUP_LABELS, Group, MONTH_LABELS } from "@/lib/categories";
import { Money } from "@/components/BlurToggle";
import ExcelImport from "@/components/ExcelImport";
import HistoryTable from "@/components/HistoryTable";

type Category = {
  id: string;
  group: Group;
  name: string;
  expiresAt: string | null;
  isInvestment: boolean;
  isAdjustment: boolean;
};

const now = new Date();
const GROUPS: Group[] = ["revenus", "fixes", "variables", "epargne"];

export default function InputClient() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [detailed, setDetailed] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [startBalance, setStartBalance] = useState<number | "">("");
  const [endBalance, setEndBalance] = useState<number | "">("");
  const [investTicker, setInvestTicker] = useState("");
  const [investQty, setInvestQty] = useState<number | "">("");
  const [investPrice, setInvestPrice] = useState<number | "">("");
  const [investCurrency, setInvestCurrency] = useState("EUR");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [newCatName, setNewCatName] = useState<Record<Group, string>>({ revenus: "", fixes: "", variables: "", epargne: "" });
  const [newCatExpiry, setNewCatExpiry] = useState<Record<Group, string>>({ revenus: "", fixes: "", variables: "", epargne: "" });

  function refetchCategories() {
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
  }
  function refetchAllEntries() {
    fetch(`/api/entries`).then((r) => r.json()).then(setAllEntries);
  }

  async function handleHistoryEdit(y: number, m: number, group: string, category: string, amount: number) {
    // Mise à jour optimiste pour un rendu instantané
    setAllEntries((prev) => {
      const idx = prev.findIndex((e) => e.year === y && e.month === m && e.group === group && e.category === category && !e.subCategory);
      if (idx === -1) return [...prev, { year: y, month: m, group, category, subCategory: "", amount }];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], amount };
      return copy;
    });
    await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: y, month: m, lines: [{ group, category, subCategory: null, amount }] }),
    });
    // Recharge le formulaire si on vient de modifier le mois actuellement affiché
    if (y === year && m === month) {
      fetch(`/api/entries?year=${y}&month=${m}`)
        .then((r) => r.json())
        .then((data: any[]) => {
          const found = data.find((e) => e.category === category && e.group === group && !e.subCategory);
          if (found) {
            const cat = categories.find((c) => c.name === category && c.group === group);
            if (cat) setAmounts((a) => ({ ...a, [cat.id]: found.amount }));
          }
        });
    }
  }

  useEffect(() => {
    refetchCategories();
    refetchAllEntries();
  }, []);

  const activeCategories = useMemo(() => {
    const cutoff = new Date(year, month - 1, 1);
    return categories.filter((c) => !c.expiresAt || new Date(c.expiresAt) >= cutoff);
  }, [categories, year, month]);

  const adjustmentCategory = activeCategories.find((c) => c.isAdjustment) ?? null;
  const investmentCategory = activeCategories.find((c) => c.isInvestment) ?? null;

  useEffect(() => {
    if (categories.length === 0) return;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;

    fetch(`/api/entries?year=${prevYear}&month=${prevMonth}`)
      .then((r) => r.json())
      .then((prevData: any[]) => {
        const map: Record<string, number> = {};
        for (const c of categories) {
          const found = prevData.find((e) => e.category === c.name && e.group === c.group && !e.subCategory);
          map[c.id] = found?.amount ?? 0;
        }
        setAmounts(map);
      });

    fetch(`/api/balances?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data: any[]) => {
        const b = data[0];
        setStartBalance(b?.startBalance ?? "");
        setEndBalance(b?.endBalance ?? "");
      });
  }, [year, month, categories.length]);

  const rawTotals = useMemo(() => {
    const t: Record<Group, number> = { revenus: 0, fixes: 0, variables: 0, epargne: 0 };
    for (const c of activeCategories) {
      if (c.isAdjustment) continue;
      t[c.group] += amounts[c.id] ?? 0;
    }
    return t;
  }, [activeCategories, amounts]);

  const adjustmentAmount = useMemo(() => {
    if (!adjustmentCategory) return 0;
    const sb = Number(startBalance) || 0;
    const eb = Number(endBalance) || 0;
    const otherCosts = rawTotals.fixes + rawTotals.variables;
    return Math.round((sb + rawTotals.revenus - otherCosts - eb) * 100) / 100;
  }, [adjustmentCategory, startBalance, endBalance, rawTotals]);

  const totals = useMemo(() => {
    const t = { ...rawTotals };
    if (adjustmentCategory) t[adjustmentCategory.group] += adjustmentAmount;
    return t;
  }, [rawTotals, adjustmentCategory, adjustmentAmount]);

  async function handleAddCategory(group: Group) {
    const name = newCatName[group].trim();
    if (!name) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group, name, expiresAt: newCatExpiry[group] || null }),
    });
    if (res.ok) {
      setNewCatName((s) => ({ ...s, [group]: "" }));
      setNewCatExpiry((s) => ({ ...s, [group]: "" }));
      refetchCategories();
    }
  }

  async function handleRenameCategory(cat: Category, newName: string) {
    if (!newName.trim() || newName.trim() === cat.name) return;
    await fetch(`/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    refetchCategories();
    refetchAllEntries();
  }

  async function handleDeleteCategory(cat: Category) {
    if (!confirm(`Supprimer la catégorie "${cat.name}" ? (l'historique déjà saisi est conservé)`)) return;
    await fetch(`/api/categories/${cat.id}`, { method: "DELETE" });
    setAmounts((a) => {
      const { [cat.id]: _, ...rest } = a;
      return rest;
    });
    refetchCategories();
  }

  async function handleToggleFlag(cat: Category, flag: "isInvestment" | "isAdjustment") {
    await fetch(`/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [flag]: !cat[flag] }),
    });
    refetchCategories();
  }

  async function handleGroupChange(categoryId: string, newGroup: Group) {
    await fetch(`/api/categories/${categoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group: newGroup }),
    });
    refetchCategories();
    refetchAllEntries();
  }

  async function handleSubmit() {
    setSaving(true);
    setSavedMsg(null);

    const lines: any[] = activeCategories.map((c) => ({
      group: c.group,
      category: c.name,
      subCategory: null,
      amount: c.isAdjustment ? adjustmentAmount : Math.round((amounts[c.id] ?? 0) * 100) / 100,
      ...(c.isInvestment && investTicker && investQty && investPrice
        ? { investment: { ticker: investTicker, quantity: Number(investQty), unitPrice: Number(investPrice), currency: investCurrency } }
        : {}),
    }));

    const [entriesRes] = await Promise.all([
      fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, lines }),
      }),
      fetch("/api/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year, month,
          startBalance: startBalance === "" ? null : Number(startBalance),
          endBalance: endBalance === "" ? null : Number(endBalance),
        }),
      }),
    ]);

    setSaving(false);
    if (entriesRes.ok) {
      setSavedMsg("Mois enregistré ✅");
      refetchAllEntries();
    } else {
      setSavedMsg("Erreur lors de l'enregistrement");
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-4">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2">
          {MONTH_LABELS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 w-24" />
        <label className="flex items-center gap-2 text-sm text-gray-700 ml-4">
          <input type="checkbox" checked={detailed} onChange={() => setDetailed((d) => !d)} />
          Vue détaillée (poste par poste)
        </label>
        <div className="ml-auto">
          <ExcelImport onImported={() => { refetchCategories(); refetchAllEntries(); }} />
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-6 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Solde en début de mois</label>
          <input
            type="number" step="0.01"
            value={startBalance}
            onChange={(e) => setStartBalance(e.target.value === "" ? "" : Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 w-32 text-right"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Solde en fin de mois</label>
          <input
            type="number" step="0.01"
            value={endBalance}
            onChange={(e) => setEndBalance(e.target.value === "" ? "" : Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 w-32 text-right"
          />
        </div>
        {adjustmentCategory && (
          <p className="text-sm text-gray-500">
            → "{adjustmentCategory.name}" sera calculé automatiquement : <Money value={adjustmentAmount} />
          </p>
        )}
      </div>

      {categories.length === 0 && (
        <p className="text-sm text-gray-500 bg-blue-50 rounded-lg p-4">
          Aucune catégorie pour l'instant. Ajoute-les ci-dessous (une par une) ou importe directement un fichier Excel —
          tes catégories seront créées automatiquement à partir de son contenu.
        </p>
      )}

      <div className="card p-6 space-y-6">
        {detailed && (
          <p className="text-xs text-gray-400">
            ⚖️ = catégorie d'ajustement automatique (une seule par mois) · 📈 = catégorie liée aux investissements
          </p>
        )}
        {!detailed ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {GROUPS.map((g) => (
              <div key={g} className="space-y-1">
                <div className="text-sm text-gray-500">{GROUP_LABELS[g]}</div>
                <div className="text-lg font-semibold"><Money value={totals[g]} /></div>
              </div>
            ))}
          </div>
        ) : (
          GROUPS.map((g) => (
            <div key={g}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">{GROUP_LABELS[g]}</h3>
              <div className="grid md:grid-cols-2 gap-3">
                {activeCategories.filter((c) => c.group === g).map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <input
                      defaultValue={c.name}
                      onBlur={(e) => handleRenameCategory(c, e.target.value)}
                      className="text-sm text-gray-700 flex-1 border border-transparent hover:border-gray-200 rounded px-1 py-0.5 focus:border-gray-300 focus:outline-none"
                      title="Cliquer pour renommer"
                    />
                    {(g === "fixes" || g === "variables") && (
                      <button
                        onClick={() => handleToggleFlag(c, "isAdjustment")}
                        title={c.isAdjustment ? "Catégorie d'ajustement automatique (cliquer pour désactiver)" : "Marquer comme catégorie d'ajustement automatique"}
                        className={`text-xs px-1.5 py-0.5 rounded ${c.isAdjustment ? "bg-amber-100 text-amber-700" : "text-gray-300 hover:text-gray-500"}`}
                      >
                        ⚖️
                      </button>
                    )}
                    {g === "epargne" && (
                      <button
                        onClick={() => handleToggleFlag(c, "isInvestment")}
                        title={c.isInvestment ? "Liée aux investissements (cliquer pour désactiver)" : "Marquer comme catégorie d'investissement"}
                        className={`text-xs px-1.5 py-0.5 rounded ${c.isInvestment ? "bg-purple-100 text-purple-700" : "text-gray-300 hover:text-gray-500"}`}
                      >
                        📈
                      </button>
                    )}
                    {c.isAdjustment ? (
                      <span className="w-32 text-right text-sm text-gray-500 italic px-3 py-1.5">
                        <Money value={adjustmentAmount} />
                      </span>
                    ) : (
                      <input
                        type="number" step="0.01"
                        value={amounts[c.id] ?? 0}
                        onChange={(e) => setAmounts((a) => ({ ...a, [c.id]: Number(e.target.value) }))}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 w-28 text-right"
                      />
                    )}
                    <button
                      onClick={() => handleDeleteCategory(c)}
                      className="text-gray-300 hover:text-red-500 text-sm px-1"
                      title="Supprimer cette catégorie"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  placeholder={`+ Ajouter une catégorie (${GROUP_LABELS[g].toLowerCase()})`}
                  value={newCatName[g]}
                  onChange={(e) => setNewCatName((s) => ({ ...s, [g]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory(g)}
                  className="border border-dashed border-gray-300 rounded-lg px-3 py-1.5 text-sm w-64"
                />
                {g === "fixes" && (
                  <input
                    type="date"
                    title="Actif jusqu'à (optionnel — pour un crédit qui se termine par exemple)"
                    value={newCatExpiry[g]}
                    onChange={(e) => setNewCatExpiry((s) => ({ ...s, [g]: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-500"
                  />
                )}
                <button onClick={() => handleAddCategory(g)} className="text-sm text-accent font-medium px-2">
                  Ajouter
                </button>
              </div>

              {g === "epargne" && investmentCategory && (amounts[investmentCategory.id] ?? 0) > 0 && (
                <div className="mt-3 p-4 bg-purple-50 rounded-lg space-y-2">
                  <p className="text-sm text-purple-800">
                    Préciser le titre acheté pour tracer ce montant dans Investissements :
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <input placeholder="Ticker (ex: MSFT)" value={investTicker} onChange={(e) => setInvestTicker(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 w-40" />
                    <input type="number" step="0.01" placeholder="Quantité" value={investQty} onChange={(e) => setInvestQty(e.target.value ? Number(e.target.value) : "")} className="border border-gray-300 rounded-lg px-3 py-1.5 w-32" />
                    <input type="number" step="0.01" placeholder="Prix unitaire" value={investPrice} onChange={(e) => setInvestPrice(e.target.value ? Number(e.target.value) : "")} className="border border-gray-300 rounded-lg px-3 py-1.5 w-32" />
                    <select value={investCurrency} onChange={(e) => setInvestCurrency(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5">
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                      <option value="CHF">CHF</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        <div className="flex items-center gap-4 pt-2">
          <button onClick={handleSubmit} disabled={saving} className="bg-accent text-white rounded-lg px-5 py-2 font-medium disabled:opacity-50">
            {saving ? "Enregistrement..." : "Enregistrer le mois"}
          </button>
          {savedMsg && <span className="text-sm text-gray-600">{savedMsg}</span>}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Historique</h2>
        <HistoryTable entries={allEntries} categories={categories} onEdit={handleHistoryEdit} onGroupChange={handleGroupChange} />
      </div>
    </div>
  );
}
