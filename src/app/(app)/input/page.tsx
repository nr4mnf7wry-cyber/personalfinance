"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GROUP_LABELS,
  GROUP_ORDER,
  INVESTMENT_CATEGORY_NAME,
  type CategoryGroupKey,
} from "@/lib/categories";
import type { CategoryDTO, EntryDTO } from "@/types";
import MonthPicker from "@/components/input/MonthPicker";
import ImportExcelDialog from "@/components/input/ImportExcelDialog";
import HistoryTable from "@/components/input/HistoryTable";
import LinkInvestmentModal from "@/components/input/LinkInvestmentModal";
import { formatAmount } from "@/components/ui/AmountText";

type Recurring = Record<string, { amount: number; fromYear: number; fromMonth: number }>;

const MONTH_SHORT = [
  "jan.", "fév.", "mar.", "avr.", "mai", "jun.",
  "jul.", "aoû.", "sep.", "oct.", "nov.", "déc.",
];

export default function InputPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [entryIds, setEntryIds] = useState<Record<string, string>>({});
  const [recurring, setRecurring] = useState<Recurring>({});
  const [startingBalance, setStartingBalance] = useState<string>("");
  const [suggestedBalance, setSuggestedBalance] = useState<number | null>(null);

  const [detailMode, setDetailMode] = useState(true);
  const [expanded, setExpanded] = useState<Record<CategoryGroupKey, boolean>>({
    income: true,
    fixed: true,
    variable: true,
    savings: true,
  });
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<{ entryId: string; amount: number } | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
  }, []);

  useEffect(() => {
    setExpanded({
      income: detailMode,
      fixed: detailMode,
      variable: detailMode,
      savings: detailMode,
    });
  }, [detailMode]);

  const loadMonth = useCallback(() => {
    setSaveMessage(null);
    Promise.all([
      fetch(`/api/entries?year=${year}&month=${month}`).then((r) => r.json()),
      fetch(`/api/entries/recurring?year=${year}&month=${month}`).then((r) => r.json()),
      fetch(`/api/entries/summary?year=${year}&month=${month}`).then((r) => r.json()),
    ]).then(([entriesData, recurringData, summaryData]) => {
      const nextAmounts: Record<string, string> = {};
      const nextIds: Record<string, string> = {};
      (entriesData.entries as EntryDTO[]).forEach((e) => {
        nextAmounts[e.categoryId] = String(e.amount);
        nextIds[e.categoryId] = e.id;
      });
      setAmounts(nextAmounts);
      setEntryIds(nextIds);
      setRecurring(recurringData.suggestions ?? {});
      setStartingBalance(
        summaryData.startingBalance !== null ? String(summaryData.startingBalance) : ""
      );
      setSuggestedBalance(summaryData.suggestedStartingBalance ?? null);
    });
  }, [year, month]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  function setAmount(categoryId: string, value: string) {
    setAmounts((prev) => ({ ...prev, [categoryId]: value }));
  }

  function applyRecurring(categoryId: string) {
    const r = recurring[categoryId];
    if (r) setAmount(categoryId, String(r.amount));
  }

  function groupTotal(group: CategoryGroupKey) {
    return categories
      .filter((c) => c.group === group)
      .reduce((sum, c) => sum + (parseFloat(amounts[c.id]) || 0), 0);
  }

  const totalIncome = groupTotal("income");
  const totalFixed = groupTotal("fixed");
  const totalVariable = groupTotal("variable");
  const totalSavings = groupTotal("savings");
  const totalExpenses = totalFixed + totalVariable;
  const startBal = parseFloat(startingBalance) || 0;
  const endingBalance = startBal + totalIncome - totalExpenses - totalSavings;
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : null;

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    const rows = categories
      .filter((c) => amounts[c.id] !== undefined && amounts[c.id] !== "")
      .map((c) => ({ categoryId: c.id, amount: parseFloat(amounts[c.id]) || 0 }));

    await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, entries: rows }),
    });

    if (startingBalance !== "") {
      await fetch("/api/entries/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, startingBalance: startBal }),
      });
    }

    setSaving(false);
    setSaveMessage("Enregistré ✓");
    loadMonth();
  }

  const investmentCategory = categories.find(
    (c) => c.group === "savings" && c.name === INVESTMENT_CATEGORY_NAME
  );
  const investmentAmount = investmentCategory
    ? parseFloat(amounts[investmentCategory.id]) || 0
    : 0;
  const investmentEntryId = investmentCategory ? entryIds[investmentCategory.id] : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-300 text-sm dark:border-slate-700">
            <button
              onClick={() => setDetailMode(true)}
              className={`rounded-l-lg px-3 py-1.5 ${detailMode ? "bg-brand-600 text-white" : ""}`}
            >
              Détaillée
            </button>
            <button
              onClick={() => setDetailMode(false)}
              className={`rounded-r-lg px-3 py-1.5 ${!detailMode ? "bg-brand-600 text-white" : ""}`}
            >
              Catégories seulement
            </button>
          </div>
          <ImportExcelDialog onImported={loadMonth} />
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {showHistory ? "Retour à la saisie" : "Voir l'historique"}
          </button>
        </div>
      </div>

      {showHistory ? (
        <HistoryTable categories={categories} />
      ) : (
        <>
          {/* Résumé en direct, comme la feuille récap Excel */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="card">
              <span className="text-xs text-slate-500">Solde de départ</span>
              <input
                type="number"
                value={startingBalance}
                placeholder={suggestedBalance !== null ? suggestedBalance.toFixed(0) : "0"}
                onChange={(e) => setStartingBalance(e.target.value)}
                className="blur-target w-full border-0 bg-transparent p-0 text-lg font-semibold outline-none"
              />
              {suggestedBalance !== null && startingBalance === "" && (
                <button
                  onClick={() => setStartingBalance(String(suggestedBalance))}
                  className="text-xs text-brand-600 underline"
                >
                  Utiliser {formatAmount(suggestedBalance)}
                </button>
              )}
            </div>
            <div className="card">
              <span className="text-xs text-slate-500">Total revenus</span>
              <p className="blur-target text-lg font-semibold text-income">
                {formatAmount(totalIncome)}
              </p>
            </div>
            <div className="card">
              <span className="text-xs text-slate-500">Total dépenses</span>
              <p className="blur-target text-lg font-semibold text-expense">
                {formatAmount(totalExpenses)}
              </p>
            </div>
            <div className="card">
              <span className="text-xs text-slate-500">Épargne / Invest.</span>
              <p className="blur-target text-lg font-semibold text-savings">
                {formatAmount(totalSavings)}
                {savingsRate !== null && (
                  <span className="ml-1 text-xs text-slate-400">({savingsRate.toFixed(0)}%)</span>
                )}
              </p>
            </div>
            <div className="card">
              <span className="text-xs text-slate-500">Solde de fin</span>
              <p className="blur-target text-lg font-semibold">{formatAmount(endingBalance)}</p>
            </div>
          </div>

          {GROUP_ORDER.map((group) => {
            const groupCategories = categories.filter((c) => c.group === group && !c.archived);
            const isExpanded = expanded[group];
            return (
              <div key={group} className="card">
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [group]: !prev[group] }))}
                  className="flex w-full items-center justify-between"
                >
                  <span className="font-semibold">{GROUP_LABELS[group]}</span>
                  <span className="blur-target text-sm text-slate-500">
                    {formatAmount(groupTotal(group))} {isExpanded ? "▲" : "▼"}
                  </span>
                </button>
                {isExpanded && (
                  <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                    {groupCategories.map((cat) => {
                      const rec = recurring[cat.id];
                      const isInvestment = group === "savings" && cat.name === INVESTMENT_CATEGORY_NAME;
                      const catAmount = parseFloat(amounts[cat.id]) || 0;
                      return (
                        <div key={cat.id} className="flex items-center justify-between gap-3 py-2">
                          <label className="text-sm text-slate-600 dark:text-slate-300">
                            {cat.name}
                          </label>
                          <div className="flex items-center gap-2">
                            {rec && (amounts[cat.id] === undefined || amounts[cat.id] === "") && (
                              <button
                                onClick={() => applyRecurring(cat.id)}
                                className="text-xs text-brand-600 underline"
                                title={`Valeur de ${MONTH_SHORT[rec.fromMonth - 1]} ${rec.fromYear}`}
                              >
                                = {formatAmount(rec.amount)} ({MONTH_SHORT[rec.fromMonth - 1]})
                              </button>
                            )}
                            {isInvestment && catAmount > 0 && (
                              <button
                                onClick={() =>
                                  investmentEntryId
                                    ? setLinkModal({ entryId: investmentEntryId, amount: catAmount })
                                    : setSaveMessage(
                                        "Enregistre d'abord le mois pour pouvoir lier l'investissement."
                                      )
                                }
                                className="rounded border border-brand-300 px-2 py-0.5 text-xs text-brand-700 dark:border-brand-700 dark:text-brand-300"
                              >
                                Lier à un achat →
                              </button>
                            )}
                            <input
                              type="number"
                              step="0.01"
                              value={amounts[cat.id] ?? ""}
                              onChange={(e) => setAmount(cat.id, e.target.value)}
                              className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-700 dark:bg-slate-800"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer le mois"}
            </button>
            {saveMessage && <span className="text-sm text-slate-500">{saveMessage}</span>}
          </div>
        </>
      )}

      {linkModal && (
        <LinkInvestmentModal
          entryId={linkModal.entryId}
          suggestedAmount={linkModal.amount}
          currency="EUR"
          onClose={() => setLinkModal(null)}
          onLinked={() => {
            setLinkModal(null);
            setSaveMessage("Investissement lié ✓");
          }}
        />
      )}
    </div>
  );
}
