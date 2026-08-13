"use client";

import { useEffect, useMemo, useState } from "react";
import { GROUP_LABELS, Group, MONTH_LABELS } from "@/lib/categories";
import { Money } from "@/components/BlurToggle";
import ExcelImport from "@/components/ExcelImport";
import HistoryTable from "@/components/HistoryTable";
import StatTile from "@/components/StatTile";

type Category = {
  id: string;
  group: Group;
  name: string;
  expiresAt: string | null;
  isInvestment: boolean;
  isAdjustment: boolean;
  order: number;
  defaultAmount: number | null;
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
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [ready, setReady] = useState(false); // true une fois le préremplissage du mois terminé (évite un auto-save prématuré)
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [newCatName, setNewCatName] = useState<Record<Group, string>>({ revenus: "", fixes: "", variables: "", epargne: "" });
  const [newCatExpiry, setNewCatExpiry] = useState<Record<Group, string>>({ revenus: "", fixes: "", variables: "", epargne: "" });
  const [stoppingCategoryId, setStoppingCategoryId] = useState<string | null>(null);
  const [stopMonthValue, setStopMonthValue] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

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
    setReady(false);
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;

    Promise.all([
      fetch(`/api/entries?year=${year}&month=${month}`).then((r) => r.json()),
      fetch(`/api/entries?year=${prevYear}&month=${prevMonth}`).then((r) => r.json()),
      fetch(`/api/balances?year=${year}&month=${month}`).then((r) => r.json()),
      fetch(`/api/balances?year=${prevYear}&month=${prevMonth}`).then((r) => r.json()),
    ]).then(([currentData, prevData, balanceData, prevBalanceData]: [any[], any[], any[], any[]]) => {
      const map: Record<string, number> = {};
      for (const c of categories) {
        const own = currentData.find((e) => e.category === c.name && e.group === c.group && !e.subCategory);
        if (own) {
          // le mois sélectionné a déjà été saisi -> on affiche SES propres valeurs
          map[c.id] = own.amount;
        } else if (c.group === "fixes") {
          // nouveau mois : seules les dépenses fixes se pré-remplissent (elles ne changent pas).
          // S'il n'y a encore aucun historique (ex: dette tout juste créée), on part du
          // montant par défaut connu (ex: la mensualité) plutôt que de 0.
          const prev = prevData.find((e) => e.category === c.name && e.group === c.group && !e.subCategory);
          map[c.id] = prev?.amount ?? c.defaultAmount ?? 0;
        } else {
          // revenus / variables / épargne : toujours vierge sur un nouveau mois
          map[c.id] = 0;
        }
      }
      setAmounts(map);

      const b = balanceData[0];
      const prevB = prevBalanceData[0];
      // le solde de fin du mois précédent devient le solde de début de ce mois-ci,
      // sauf si ce mois a déjà son propre solde de début explicitement saisi
      setStartBalance(b?.startBalance ?? prevB?.endBalance ?? "");
      setEndBalance(b?.endBalance ?? "");
      // laisse React appliquer les nouveaux states avant d'activer l'auto-save,
      // pour ne pas déclencher une sauvegarde sur les anciennes valeurs
      setTimeout(() => setReady(true), 0);
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

  async function saveNow() {
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

    setSaveStatus(entriesRes.ok ? "saved" : "idle");
    if (entriesRes.ok) refetchAllEntries();
  }

  // Auto-sauvegarde : dès qu'un montant, le solde ou les infos d'investissement changent,
  // on enregistre automatiquement après une courte pause (pas de bouton à cliquer)
  useEffect(() => {
    if (!ready) return;
    setSaveStatus("saving");
    const t = setTimeout(() => { saveNow(); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amounts, startBalance, endBalance, investTicker, investQty, investPrice, investCurrency, adjustmentAmount, ready]);

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
    if (!confirm(`Supprimer complètement la catégorie "${cat.name}" ? (l'historique déjà saisi est conservé, mais elle disparaîtra de tous les mois du formulaire, passés comme futurs)`)) return;
    await fetch(`/api/categories/${cat.id}`, { method: "DELETE" });
    setAmounts((a) => {
      const { [cat.id]: _, ...rest } = a;
      return rest;
    });
    refetchCategories();
  }

  // Arrête une catégorie à partir d'un mois donné (inclus), sans toucher aux mois
  // antérieurs : ni le formulaire pour les mois passés, ni l'historique ne sont affectés.
  async function handleStopCategory(cat: Category, stopYear: number, stopMonth: number) {
    // dernier mois encore actif = le mois juste avant celui choisi
    const lastActiveMonth = stopMonth === 1 ? 12 : stopMonth - 1;
    const lastActiveYear = stopMonth === 1 ? stopYear - 1 : stopYear;
    await fetch(`/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresAt: new Date(lastActiveYear, lastActiveMonth - 1, 1).toISOString() }),
    });
    setStoppingCategoryId(null);
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

  async function handleDeleteRow(group: string, category: string) {
    await fetch(`/api/entries?group=${encodeURIComponent(group)}&category=${encodeURIComponent(category)}`, {
      method: "DELETE",
    });
    refetchAllEntries();
  }

  async function handleDeleteAllHistory() {
    await fetch("/api/entries", { method: "DELETE" });
    refetchAllEntries();
  }

  async function handleReorder(categoryId: string, direction: "up" | "down") {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const sameGroup = categories.filter((c) => c.group === cat.group).sort((a, b) => a.order - b.order);
    const idx = sameGroup.findIndex((c) => c.id === categoryId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sameGroup.length) return;
    const other = sameGroup[swapIdx];
    await Promise.all([
      fetch(`/api/categories/${cat.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: other.order }),
      }),
      fetch(`/api/categories/${other.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: cat.order }),
      }),
    ]);
    refetchCategories();
  }

  return (
    <div className="space-y-8">
      {/* Barre d'outils */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {MONTH_LABELS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 w-24 text-sm" />
        </div>

        {/* Segmented control condensé/détaillé */}
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          <button
            onClick={() => setDetailed(false)}
            className={`px-3 py-1.5 ${!detailed ? "bg-accent text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Condensé
          </button>
          <button
            onClick={() => setDetailed(true)}
            className={`px-3 py-1.5 border-l border-gray-300 ${detailed ? "bg-accent text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Détaillé
          </button>
        </div>

        {/* Badge de sauvegarde, toujours visible */}
        <div className="text-sm flex items-center gap-1.5">
          {saveStatus === "saving" && <span className="text-gray-400">Enregistrement...</span>}
          {saveStatus === "saved" && <span className="text-green flex items-center gap-1">● à jour</span>}
        </div>

        <div className="ml-auto">
          <ExcelImport onImported={() => { refetchCategories(); refetchAllEntries(); }} />
        </div>
      </div>

      {/* Solde du compte, sous forme de tuiles compactes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <label className="text-sm text-gray-500 block mb-1">Solde en début de mois</label>
          <input
            type="number" step="0.01"
            value={startBalance}
            onChange={(e) => setStartBalance(e.target.value === "" ? "" : Number(e.target.value))}
            className="text-lg font-semibold w-full border-none p-0 focus:outline-none tabular-nums"
            placeholder="—"
          />
        </div>
        <div className="card p-4">
          <label className="text-sm text-gray-500 block mb-1">Solde en fin de mois</label>
          <input
            type="number" step="0.01"
            value={endBalance}
            onChange={(e) => setEndBalance(e.target.value === "" ? "" : Number(e.target.value))}
            className="text-lg font-semibold w-full border-none p-0 focus:outline-none tabular-nums"
            placeholder="—"
          />
        </div>
        {adjustmentCategory && (
          <div className="card p-4 md:col-span-2 flex items-center">
            <p className="text-sm text-gray-500">
              "{adjustmentCategory.name}" calculé automatiquement : <span className="font-semibold text-gray-800"><Money value={adjustmentAmount} /></span>
            </p>
          </div>
        )}
      </div>

      {categories.length === 0 && (
        <p className="text-sm text-gray-500 bg-[#F5F0E6] rounded-lg p-4">
          Aucune catégorie pour l'instant. Ajoute-les ci-dessous (une par une) ou importe directement un fichier Excel —
          tes catégories seront créées automatiquement à partir de son contenu.
        </p>
      )}

      {!detailed ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {GROUPS.map((g) => (
            <StatTile key={g} label={GROUP_LABELS[g]} value={totals[g]} />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((g) => (
            <div key={g} className="card overflow-visible">
              <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">{GROUP_LABELS[g]}</h3>
                <span className="text-sm text-gray-500"><Money value={totals[g]} /></span>
              </div>

              {activeCategories.filter((c) => c.group === g).length > 0 && (
                <div className="px-5 pt-2 pb-1 flex text-xs text-gray-400 uppercase tracking-wide">
                  <span className="flex-1">Catégorie</span>
                  <span className="w-28 text-right mr-8">Montant</span>
                </div>
              )}

              <div>
                {activeCategories.filter((c) => c.group === g).map((c) => (
                  <div key={c.id} className="relative px-5 py-2 flex items-center gap-2 border-t border-gray-50 first:border-t-0 hover:bg-gray-50/60">
                    <div className="flex-1 flex items-center gap-1.5">
                      <input
                        defaultValue={c.name}
                        onBlur={(e) => handleRenameCategory(c, e.target.value)}
                        className="text-sm text-gray-700 flex-1 bg-transparent border border-transparent hover:border-gray-200 rounded px-1 py-0.5 focus:border-gray-300 focus:outline-none"
                        title="Cliquer pour renommer"
                      />
                      {c.isAdjustment && <span className="text-xs bg-[#F5F0E6] text-accent rounded px-1.5 py-0.5">ajustement</span>}
                      {c.isInvestment && <span className="text-xs bg-[#F5F0E6] text-accent rounded px-1.5 py-0.5">investissement</span>}
                    </div>

                    {c.isAdjustment ? (
                      <span className="w-28 text-right text-sm text-gray-500 italic tabular-nums">
                        <Money value={adjustmentAmount} />
                      </span>
                    ) : (
                      <input
                        type="number" step="0.01"
                        value={amounts[c.id] ?? 0}
                        onChange={(e) => setAmounts((a) => ({ ...a, [c.id]: Number(e.target.value) }))}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 w-28 text-right text-sm tabular-nums focus:border-accent focus:outline-none"
                      />
                    )}

                    <button
                      onClick={() => setMenuOpenId(menuOpenId === c.id ? null : c.id)}
                      className="text-gray-300 hover:text-gray-600 w-6 text-center"
                      title="Actions"
                    >
                      ⋯
                    </button>

                    {menuOpenId === c.id && (
                      <div className="absolute right-5 top-10 z-10 card bg-white shadow-lg py-1 w-64 text-sm">
                        {(g === "fixes" || g === "variables") && (
                          <button
                            onClick={() => { handleToggleFlag(c, "isAdjustment"); setMenuOpenId(null); }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
                          >
                            Catégorie d'ajustement auto {c.isAdjustment && <span className="text-accent">✓</span>}
                          </button>
                        )}
                        {g === "epargne" && (
                          <button
                            onClick={() => { handleToggleFlag(c, "isInvestment"); setMenuOpenId(null); }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
                          >
                            Liée aux investissements {c.isInvestment && <span className="text-accent">✓</span>}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setStoppingCategoryId(c.id);
                            setStopMonthValue(`${year}-${String(month).padStart(2, "0")}`);
                            setMenuOpenId(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50"
                        >
                          Arrêter à partir d'un mois...
                        </button>
                        <button
                          onClick={() => { handleDeleteCategory(c); setMenuOpenId(null); }}
                          className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600"
                        >
                          Supprimer complètement
                        </button>
                      </div>
                    )}

                    {stoppingCategoryId === c.id && (
                      <div className="absolute left-5 right-5 top-10 z-10 card bg-white shadow-lg p-3 flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-gray-700">Ne plus afficher à partir de :</span>
                        <input
                          type="month"
                          value={stopMonthValue}
                          onChange={(e) => setStopMonthValue(e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-1"
                        />
                        <button
                          onClick={() => {
                            const [y, m] = stopMonthValue.split("-").map(Number);
                            if (y && m) handleStopCategory(c, y, m);
                          }}
                          className="bg-accent text-white rounded-lg px-3 py-1"
                        >
                          Confirmer
                        </button>
                        <span className="text-gray-400 text-xs">l'historique précédent reste intact</span>
                        <button onClick={() => setStoppingCategoryId(null)} className="text-gray-400 text-xs ml-auto">
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Ligne fantôme d'ajout */}
                <div className="px-5 py-2.5 border-t border-gray-50 flex flex-wrap items-center gap-2">
                  <span className="text-gray-300">+</span>
                  <input
                    placeholder="Ajouter une catégorie..."
                    value={newCatName[g]}
                    onChange={(e) => setNewCatName((s) => ({ ...s, [g]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCategory(g)}
                    className="flex-1 min-w-[160px] text-sm bg-transparent border-none focus:outline-none placeholder:text-gray-300"
                  />
                  {g === "fixes" && (
                    <input
                      type="date"
                      title="Actif jusqu'à (optionnel — pour un crédit qui se termine par exemple)"
                      value={newCatExpiry[g]}
                      onChange={(e) => setNewCatExpiry((s) => ({ ...s, [g]: e.target.value }))}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-500"
                    />
                  )}
                  {newCatName[g] && (
                    <button onClick={() => handleAddCategory(g)} className="text-sm text-accent font-medium px-2">
                      Ajouter
                    </button>
                  )}
                </div>
              </div>

              {g === "epargne" && investmentCategory && (amounts[investmentCategory.id] ?? 0) > 0 && (
                <div className="mx-5 mb-4 p-4 bg-[#F5F0E6] rounded-lg space-y-2">
                  <p className="text-sm text-ink">
                    Préciser le titre acheté pour tracer ce montant dans Investissements :
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <input placeholder="Ticker (ex: MSFT)" value={investTicker} onChange={(e) => setInvestTicker(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 w-40 text-sm" />
                    <input type="number" step="0.01" placeholder="Quantité" value={investQty} onChange={(e) => setInvestQty(e.target.value ? Number(e.target.value) : "")} className="border border-gray-300 rounded-lg px-3 py-1.5 w-32 text-sm" />
                    <input type="number" step="0.01" placeholder="Prix unitaire" value={investPrice} onChange={(e) => setInvestPrice(e.target.value ? Number(e.target.value) : "")} className="border border-gray-300 rounded-lg px-3 py-1.5 w-32 text-sm" />
                    <select value={investCurrency} onChange={(e) => setInvestCurrency(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                      <option value="CHF">CHF</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Historique</h2>
        <HistoryTable
          entries={allEntries}
          categories={categories}
          onEdit={handleHistoryEdit}
          onGroupChange={handleGroupChange}
          onDeleteRow={handleDeleteRow}
          onReorder={handleReorder}
          onDeleteAll={handleDeleteAllHistory}
        />
      </div>
    </div>
  );
}
