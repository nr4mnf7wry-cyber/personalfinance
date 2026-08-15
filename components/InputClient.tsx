"use client";

import { useEffect, useMemo, useState } from "react";
import { GROUP_LABELS, Group, MONTH_LABELS } from "@/lib/categories";
import { Money } from "@/components/BlurToggle";
import ExcelImport from "@/components/ExcelImport";
import StatTile from "@/components/StatTile";
import MonthYearPicker from "@/components/MonthYearPicker";

type Category = {
  id: string;
  group: Group;
  name: string;
  expiresAt: string | null;
  isInvestment: boolean;
  isAdjustment: boolean;
  isEssential: boolean | null;
  parentGroup: string | null;
  order: number;
  defaultAmount: number | null;
};

const now = new Date();
const GROUPS: Group[] = ["revenus", "fixes", "variables", "epargne"];
// Épargne n'est plus affichée comme catégorie à saisir manuellement : elle est
// désormais calculée automatiquement (solde fin - solde début, voir plus haut sur la
// page). Le suivi des investissements se fait directement sur /investments.
const DETAILED_GROUPS: Group[] = ["revenus", "fixes", "variables"];

export default function InputClient() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [detailed, setDetailed] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [tags, setTags] = useState<Record<string, string[]>>({});
  const [startBalance, setStartBalance] = useState<number | "">("");
  const [endBalance, setEndBalance] = useState<number | "">("");
  const [investTicker, setInvestTicker] = useState("");
  const [investQty, setInvestQty] = useState<number | "">("");
  const [investPrice, setInvestPrice] = useState<number | "">("");
  const [investCurrency, setInvestCurrency] = useState("EUR");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [ready, setReady] = useState(false); // true une fois le préremplissage du mois terminé (évite un auto-save prématuré)
  const [newCatName, setNewCatName] = useState<Record<Group, string>>({ revenus: "", fixes: "", variables: "", epargne: "" });
  const [newCatExpiry, setNewCatExpiry] = useState<Record<Group, string>>({ revenus: "", fixes: "", variables: "", epargne: "" });
  const [stoppingCategoryId, setStoppingCategoryId] = useState<string | null>(null);
  const [stopMonthValue, setStopMonthValue] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [prevMonthRevenus, setPrevMonthRevenus] = useState(0);
  const [investedThisMonth, setInvestedThisMonth] = useState(0);
  const [investedPrevMonth, setInvestedPrevMonth] = useState(0);

  function refetchCategories() {
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
  }

  useEffect(() => {
    refetchCategories();
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
      const tagMap: Record<string, string[]> = {};
      for (const c of categories) {
        const own = currentData.find((e) => e.category === c.name && e.group === c.group && !e.subCategory);
        if (own) {
          // le mois sélectionné a déjà été saisi -> on affiche SES propres valeurs
          map[c.id] = own.amount;
          tagMap[c.id] = own.tags ?? [];
        } else if (c.group === "fixes") {
          // nouveau mois : seules les dépenses fixes se pré-remplissent (elles ne changent pas).
          // S'il n'y a encore aucun historique (ex: dette tout juste créée), on part du
          // montant par défaut connu (ex: la mensualité) plutôt que de 0.
          const prev = prevData.find((e) => e.category === c.name && e.group === c.group && !e.subCategory);
          map[c.id] = prev?.amount ?? c.defaultAmount ?? 0;
          tagMap[c.id] = []; // les tags ne se reportent jamais d'un mois à l'autre
        } else {
          // revenus / variables / épargne : toujours vierge sur un nouveau mois
          map[c.id] = 0;
          tagMap[c.id] = [];
        }
      }
      setAmounts(map);
      setTags(tagMap);

      // Revenus du mois précédent, pour le contrôle mensuel plus bas
      setPrevMonthRevenus(prevData.filter((e: any) => e.group === "revenus").reduce((s: number, e: any) => s + e.amount, 0));

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

  // Montant net investi (bourse + non coté) ce mois-ci ET le mois précédent, pour le
  // contrôle mensuel — de l'argent investi en X-1 n'a jamais rejoint le pot à répartir
  // pour X, et l'argent investi en X sort du compte de X sans être une "dépense".
  useEffect(() => {
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;

    Promise.all([
      fetch("/api/investments").then((r) => r.json()),
      fetch("/api/private-investments").then((r) => r.json()),
    ]).then(([transactions, privateInvestments]: [any[], any[]]) => {
      const currencies = Array.from(new Set([
        ...transactions.map((t) => t.currency),
        ...privateInvestments.map((p) => p.currency),
      ].filter((c) => c && c !== "EUR")));

      Promise.all(currencies.map((c) => fetch(`/api/exchange-rate?from=${c}&to=EUR`).then((r) => (r.ok ? r.json() : { rate: 1 })).catch(() => ({ rate: 1 }))))
        .then((rateResults) => {
          const rates: Record<string, number> = { EUR: 1 };
          currencies.forEach((c, i) => { rates[c] = rateResults[i]?.rate ?? 1; });

          function investedIn(y: number, m: number) {
            const listed = transactions
              .filter((t) => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() + 1 === m; })
              .reduce((s, t) => s + (t.type === "vente" ? -t.amount : t.amount) * (rates[t.currency] ?? 1), 0);
            const nonListed = privateInvestments
              .filter((p) => { const d = new Date(p.startDate); return d.getFullYear() === y && d.getMonth() + 1 === m; })
              .reduce((s, p) => s + p.amountInvested * (rates[p.currency] ?? 1), 0);
            return listed + nonListed;
          }

          setInvestedThisMonth(investedIn(year, month));
          setInvestedPrevMonth(investedIn(prevYear, prevMonth));
        });
    });
  }, [year, month]);

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
      tags: tags[c.id] ?? [],
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
  }

  // Auto-sauvegarde : dès qu'un montant, le solde ou les infos d'investissement changent,
  // on enregistre automatiquement après une courte pause (pas de bouton à cliquer)
  useEffect(() => {
    if (!ready) return;
    setSaveStatus("saving");
    const t = setTimeout(() => { saveNow(); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amounts, tags, startBalance, endBalance, investTicker, investQty, investPrice, investCurrency, adjustmentAmount, ready]);

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

  async function handleSetEssential(cat: Category, value: boolean | null) {
    await fetch(`/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEssential: value }),
    });
    refetchCategories();
  }

  async function handleSetParentGroup(cat: Category, value: string) {
    await fetch(`/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentGroup: value.trim() || null }),
    });
    refetchCategories();
  }

  // Bascule rapide entre dépense fixe et variable, directement depuis la saisie du mois
  // (jusqu'ici il fallait passer par l'historique pour changer le groupe d'une catégorie)
  async function handleSwitchFixedVariable(cat: Category) {
    const newGroup: Group = cat.group === "fixes" ? "variables" : "fixes";
    await fetch(`/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group: newGroup }),
    });
    setMenuOpenId(null);
    refetchCategories();
  }

  return (
    <div className="space-y-8">
      {/* Barre d'outils */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <MonthYearPicker
          year={year}
          month={month}
          onChange={(y, m) => { setYear(y); setMonth(m); }}
        />

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
          <ExcelImport onImported={() => refetchCategories()} />
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

      {/* Contrôle mensuel : le solde ne devrait bouger que du fait des revenus du mois
          précédent (déjà en banque, à répartir) moins les dépenses de ce mois — l'argent
          investi ce mois-ci explique légitimement un écart, donc il est isolé à part. */}
      {startBalance !== "" && endBalance !== "" && (() => {
        const actualDelta = Number(endBalance) - Number(startBalance);
        const depensesThisMonth = totals.fixes + totals.variables;
        const expected = prevMonthRevenus - investedPrevMonth - depensesThisMonth;
        const correctedActual = actualDelta + investedThisMonth;
        const ecart = Math.round((correctedActual - expected) * 100) / 100;
        const ok = Math.abs(ecart) < 1;
        const prevMonthLabel = MONTH_LABELS[(month === 1 ? 12 : month - 1) - 1];
        return (
          <div className={`card p-4 text-sm ${ok ? "border-green-200" : "border-amber-300"}`}>
            <p className="font-medium text-ink mb-1">Contrôle mensuel</p>
            <p className="text-gray-500">
              Attendu (revenus {prevMonthLabel}{investedPrevMonth !== 0 ? ` moins investi en ${prevMonthLabel}` : ""} − dépenses de ce mois) : <Money value={expected} /> · Constaté (solde fin − solde début{investedThisMonth !== 0 ? " + investi ce mois" : ""}) : <Money value={correctedActual} />
            </p>
            <p className={`mt-1 font-medium ${ok ? "text-green" : "text-amber-600"}`}>
              {ok ? "✓ Cohérent" : `⚠ Écart de ${ecart > 0 ? "+" : ""}${ecart.toFixed(2)} € — vérifie qu'aucune dépense ou entrée d'argent n'a été oubliée`}
            </p>
            {(investedThisMonth !== 0 || investedPrevMonth !== 0) && (
              <p className="text-xs text-gray-400 mt-1">
                {investedPrevMonth !== 0 && <>investi en {prevMonthLabel} (jamais redistribué pour ce mois) : <Money value={investedPrevMonth} /></>}
                {investedThisMonth !== 0 && investedPrevMonth !== 0 && " · "}
                {investedThisMonth !== 0 && <>investi ce mois-ci (bourse + non coté) : <Money value={investedThisMonth} /></>}
              </p>
            )}
          </div>
        );
      })()}

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
          {DETAILED_GROUPS.map((g) => (
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

                    {(g === "fixes" || g === "variables") && (
                      <input
                        placeholder="tags..."
                        value={(tags[c.id] ?? []).join(", ")}
                        onChange={(e) => setTags((t) => ({ ...t, [c.id]: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))}
                        title="Tags libres, séparés par des virgules (ex: vacances, cadeaux)"
                        className="text-xs text-gray-500 bg-transparent border border-transparent hover:border-gray-200 rounded px-1.5 py-1 w-28 focus:border-gray-300 focus:outline-none placeholder:text-gray-300"
                      />
                    )}

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
                            onClick={() => handleSwitchFixedVariable(c)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 font-medium text-ink"
                          >
                            Passer en dépense {g === "fixes" ? "variable" : "fixe"}
                          </button>
                        )}
                        {(g === "fixes" || g === "variables") && (
                          <button
                            onClick={() => { handleToggleFlag(c, "isAdjustment"); setMenuOpenId(null); }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
                          >
                            Catégorie d'ajustement auto {c.isAdjustment && <span className="text-accent">✓</span>}
                          </button>
                        )}
                        {(g === "fixes" || g === "variables") && (
                          <>
                            <button
                              onClick={() => { handleSetEssential(c, c.isEssential === true ? null : true); setMenuOpenId(null); }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
                            >
                              Dépense essentielle {c.isEssential === true && <span className="text-accent">✓</span>}
                            </button>
                            <button
                              onClick={() => { handleSetEssential(c, c.isEssential === false ? null : false); setMenuOpenId(null); }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
                            >
                              Dépense discrétionnaire {c.isEssential === false && <span className="text-accent">✓</span>}
                            </button>
                          </>
                        )}
                        <div className="px-4 py-2 border-t border-gray-100">
                          <label className="text-xs text-gray-400 block mb-1">Regroupement (ex: "Car" pour Carfuel, Carinsurance...)</label>
                          <input
                            defaultValue={c.parentGroup ?? ""}
                            onBlur={(e) => handleSetParentGroup(c, e.target.value)}
                            placeholder="aucun"
                            className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:border-accent focus:outline-none"
                          />
                        </div>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
