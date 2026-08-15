"use client";

import { useMemo } from "react";
import Link from "next/link";
import StatTile from "@/components/StatTile";
import { MONTH_LABELS } from "@/lib/categories";
import { useWealthSnapshot } from "@/lib/useWealthSnapshot";
import { savingsRateTrendInsight, expenseConcentrationInsight, cashflowStreakInsight, Insight } from "@/lib/insights";

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;

// Vue d'ensemble : le strict nécessaire pour savoir où on en est en quelques secondes.
// Le détail (évolution du patrimoine, comparaisons, ratios...) vit sur Patrimoine et Explorer.
export default function DashboardGeneral() {
  const { loading, entries, monthTotals, totalWealth } = useWealthSnapshot();

  const currentMonthTotals = monthTotals.find((t) => t.year === CURRENT_YEAR && t.month === CURRENT_MONTH);
  const prevMonth = CURRENT_MONTH === 1 ? 12 : CURRENT_MONTH - 1;
  const prevYear = CURRENT_MONTH === 1 ? CURRENT_YEAR - 1 : CURRENT_YEAR;
  const lastClosed = monthTotals.find((t) => t.year === prevYear && t.month === prevMonth);

  const beforeLastClosedMonth = prevMonth === 1 ? 12 : prevMonth - 1;
  const beforeLastClosedYear = prevMonth === 1 ? prevYear - 1 : prevYear;
  const beforeLastClosed = monthTotals.find((t) => t.year === beforeLastClosedYear && t.month === beforeLastClosedMonth);

  function pctDelta(cur: number | undefined, prev: number | undefined): number | null {
    if (cur === undefined || prev === undefined || !prev) return null;
    return ((cur - prev) / prev) * 100;
  }

  const donutData = useMemo(() => {
    const rows = entries.filter((e) => e.year === prevYear && e.month === prevMonth && (e.group === "fixes" || e.group === "variables"));
    return rows.map((r) => ({ name: r.category, value: r.amount }));
  }, [entries, prevYear, prevMonth]);

  const insights: Insight[] = useMemo(() => {
    const list: (Insight | null)[] = [
      savingsRateTrendInsight(monthTotals),
      expenseConcentrationInsight(donutData.map((d) => ({ category: d.name, amount: d.value })), lastClosed?.depenses ?? 0),
      cashflowStreakInsight(monthTotals),
    ];
    return list.filter((i): i is Insight => i !== null);
  }, [monthTotals, donutData, lastClosed]);

  if (loading) return <p className="text-gray-500">Chargement...</p>;
  if (entries.length === 0) {
    return (
      <p className="text-gray-500">
        Aucune donnée pour le moment. Commence par une <Link href="/input" className="text-accent">saisie mensuelle</Link>.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {!currentMonthTotals && (
        <div className="card p-4 bg-[#F5F0E6] border-accent/30 flex items-center justify-between">
          <p className="text-sm text-ink">
            Tu n'as pas encore saisi {MONTH_LABELS[CURRENT_MONTH - 1]} {CURRENT_YEAR}.
          </p>
          <Link href="/input" className="text-sm bg-accent text-white rounded-lg px-4 py-2 font-medium">
            Saisir ce mois →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Patrimoine total" value={totalWealth} />
        <StatTile label={`Revenus — ${MONTH_LABELS[CURRENT_MONTH - 1].slice(0, 3)}`} value={currentMonthTotals?.revenus ?? 0} />
        <StatTile label={`Dépenses — ${MONTH_LABELS[prevMonth - 1].slice(0, 3)}`} value={lastClosed?.depenses ?? 0} delta={pctDelta(lastClosed?.depenses, beforeLastClosed?.depenses)} higherIsBetter={false} />
        <StatTile label={`Taux d'épargne — ${MONTH_LABELS[prevMonth - 1].slice(0, 3)}`} value={lastClosed?.savingsRate ?? 0} isCurrency={false} delta={pctDelta(lastClosed?.savingsRate, beforeLastClosed?.savingsRate)} />
      </div>

      {insights.length > 0 && (
        <div className="card p-5 space-y-2">
          {insights.map((ins, i) => (
            <p key={i} className="text-sm flex items-start gap-2">
              <span className={ins.tone === "positive" ? "text-green" : ins.tone === "negative" ? "text-red" : "text-gray-400"}>●</span>
              <span className="text-gray-700">{ins.text}</span>
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/patrimoine" className="text-accent font-medium">Voir l'évolution complète du patrimoine →</Link>
        <Link href="/explorer" className="text-accent font-medium">Explorer les dépenses en détail →</Link>
      </div>
    </div>
  );
}
