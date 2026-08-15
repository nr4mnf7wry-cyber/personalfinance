"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, YAxis } from "recharts";
import Link from "next/link";
import StatTile from "@/components/StatTile";
import { Money } from "@/components/BlurToggle";
import { MONTH_LABELS } from "@/lib/categories";
import { useWealthSnapshot } from "@/lib/useWealthSnapshot";
import { computeWealthEvolution } from "@/lib/wealth";
import { savingsRateTrendInsight, expenseConcentrationInsight, cashflowStreakInsight, Insight } from "@/lib/insights";
import { GOLD } from "@/lib/theme";

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;

type Goal = { id: string; name: string; targetAmount: number };

// Vue d'ensemble : le strict nécessaire pour savoir où on en est en quelques secondes,
// mais pas vide pour autant — une mini-tendance du patrimoine et un aperçu du principal
// objectif donnent un vrai sens du mouvement, sans dupliquer Patrimoine/Explorer/Projeter.
export default function DashboardGeneral() {
  const { loading, entries, monthTotals, balancesCapped, transactions, rates, grossAssets, totalWealth } = useWealthSnapshot();
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    fetch("/api/goals").then((r) => r.json()).then(setGoals).catch(() => {});
  }, []);

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

  // Mini-tendance du patrimoine — juste la forme de la courbe, pas le détail complet
  const wealthSeries = useMemo(
    () => computeWealthEvolution(balancesCapped, transactions, rates).slice(-12),
    [balancesCapped, transactions, rates]
  );

  // Objectif principal — le premier créé, à défaut d'un ordre de priorité explicite
  const mainGoal = goals[0];
  const goalProgress = mainGoal && mainGoal.targetAmount > 0 ? Math.min((grossAssets / mainGoal.targetAmount) * 100, 100) : 0;

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

      <div className="grid md:grid-cols-2 gap-4">
        {/* Mini-tendance patrimoine */}
        <Link href="/patrimoine" className="card p-4 block hover:border-accent/40 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-gray-500">Tendance du patrimoine</p>
            <span className="text-xs text-accent">voir le détail →</span>
          </div>
          {wealthSeries.length > 1 ? (
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={wealthSeries.map((w) => ({ total: w.total }))}>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Area type="monotone" dataKey="total" stroke={GOLD} fill={GOLD} fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 py-6">Pas encore assez d'historique.</p>
          )}
        </Link>

        {/* Aperçu de l'objectif principal */}
        <Link href="/projeter" className="card p-4 block hover:border-accent/40 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-gray-500">Objectif principal</p>
            <span className="text-xs text-accent">voir tous les objectifs →</span>
          </div>
          {mainGoal ? (
            <div className="pt-2">
              <p className="font-medium text-ink">{mainGoal.name}</p>
              <p className="text-sm text-gray-500 mb-2">
                <Money value={grossAssets} /> / <Money value={mainGoal.targetAmount} />
              </p>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${goalProgress}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-6">Aucun objectif défini pour l'instant.</p>
          )}
        </Link>
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

      <Link href="/explorer" className="text-accent font-medium text-sm inline-block">Explorer les dépenses en détail →</Link>
    </div>
  );
}
