"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, LineChart, Line,
} from "recharts";
import Link from "next/link";
import StatTile from "@/components/StatTile";
import { Money } from "@/components/BlurToggle";
import { GROUP_COLORS, MONTH_LABELS } from "@/lib/categories";
import { yearTotals } from "@/lib/aggregate";
import { computeWealthEvolution } from "@/lib/wealth";
import { useWealthSnapshot } from "@/lib/useWealthSnapshot";
import GoalsSection from "@/components/GoalsSection";
import HouseholdWealth from "@/components/HouseholdWealth";
import { savingsRateTrendInsight, expenseConcentrationInsight, cashflowStreakInsight, Insight } from "@/lib/insights";
import { WEALTH_PALETTE, GOLD, POSITIVE, NEGATIVE } from "@/lib/theme";

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;
const WEALTH_COLORS = WEALTH_PALETTE;
const TOOLTIP_STYLE = { fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(18,35,63,0.08)" };

export default function DashboardGeneral() {
  const {
    loading, entries, monthTotals, balancesCapped, transactions, privateInvestments, rates,
    liquidBalance, listedPortfolioValue, privateInvestedValue, portfolioValue, totalDebtRemaining, totalWealth, grossAssets, avgMonthlySavings, referenceDate,
  } = useWealthSnapshot();

  const years = Array.from(new Set(monthTotals.map((t) => t.year))).sort();

  // Le résumé exécutif s'appuie sur le dernier mois CLOS (mois précédent) pour dépenses/épargne/taux
  // (le mois en cours est presque toujours incomplet), mais les revenus du mois EN COURS sont
  // généralement déjà connus (salaire versé en début de mois) donc affichés tels quels.
  const currentMonthTotals = monthTotals.find((t) => t.year === CURRENT_YEAR && t.month === CURRENT_MONTH);
  const prevMonth = CURRENT_MONTH === 1 ? 12 : CURRENT_MONTH - 1;
  const prevYear = CURRENT_MONTH === 1 ? CURRENT_YEAR - 1 : CURRENT_YEAR;
  const lastClosed = monthTotals.find((t) => t.year === prevYear && t.month === prevMonth);

  // Mois avant le dernier clos (pour comparer dépenses/épargne/taux) et mois avant le
  // mois en cours (pour comparer les revenus) — donne un vrai point de comparaison
  const beforeLastClosedMonth = prevMonth === 1 ? 12 : prevMonth - 1;
  const beforeLastClosedYear = prevMonth === 1 ? prevYear - 1 : prevYear;
  const beforeLastClosed = monthTotals.find((t) => t.year === beforeLastClosedYear && t.month === beforeLastClosedMonth);
  const beforeCurrentMonth = prevMonth;
  const beforeCurrentYear = prevYear;
  const beforeCurrent = monthTotals.find((t) => t.year === beforeCurrentYear && t.month === beforeCurrentMonth);

  function pctDelta(cur: number | undefined, prev: number | undefined): number | null {
    if (cur === undefined || prev === undefined || !prev) return null;
    return ((cur - prev) / prev) * 100;
  }

  const donutData = useMemo(() => {
    const rows = entries.filter((e) => e.year === prevYear && e.month === prevMonth && (e.group === "fixes" || e.group === "variables"));
    return rows.map((r) => ({ name: r.category, value: r.amount }));
  }, [entries, prevYear, prevMonth]);

  const annualData = useMemo(
    () => years.map((y) => {
      const t = yearTotals(monthTotals, y);
      return { year: y, Revenus: t.revenus, Dépenses: t.depenses, Épargne: t.epargne };
    }),
    [years, monthTotals]
  );


  // Évolution du patrimoine total (liquidités + investissements cotés, mois par mois)
  const wealthSeries = useMemo(
    () => computeWealthEvolution(balancesCapped, transactions, rates),
    [balancesCapped, transactions, rates]
  );
  const wealthDelta = useMemo(() => {
    if (wealthSeries.length < 2) return { total: null, invested: null };
    const cur = wealthSeries[wealthSeries.length - 1];
    const prev = wealthSeries[wealthSeries.length - 2];
    return {
      total: prev.total ? ((cur.total - prev.total) / Math.abs(prev.total)) * 100 : null,
      invested: prev.invested ? ((cur.invested - prev.invested) / Math.abs(prev.invested)) * 100 : null,
    };
  }, [wealthSeries]);

  const cashflowSeries = useMemo(
    () => monthTotals.map((t) => ({
      label: `${MONTH_LABELS[t.month - 1].slice(0, 3)} ${t.year}`,
      Revenus: t.revenus,
      Dépenses: t.depenses,
      Net: t.net,
    })),
    [monthTotals]
  );

  const insights: Insight[] = useMemo(() => {
    const list: (Insight | null)[] = [
      savingsRateTrendInsight(monthTotals),
      expenseConcentrationInsight(donutData.map((d) => ({ category: d.name, amount: d.value })), lastClosed?.depenses ?? 0),
      cashflowStreakInsight(monthTotals),
    ];
    return list.filter((i): i is Insight => i !== null);
  }, [monthTotals, donutData, lastClosed]);

  const wealthAllocation = [
    { name: "Liquidités", value: Math.max(liquidBalance ?? 0, 0) },
    { name: "Investissements", value: Math.max(portfolioValue, 0) },
  ].filter((w) => w.value > 0);

  if (loading) return <p className="text-gray-500">Chargement...</p>;
  if (entries.length === 0) {
    return (
      <p className="text-gray-500">
        Aucune donnée pour le moment. Commence par une <Link href="/input" className="text-accent">saisie mensuelle</Link>.
      </p>
    );
  }

  return (
    <div className="space-y-12">
      {/* Rappel de saisie si le mois en cours n'a pas encore été touché */}
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

      {/* Executive Summary */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Résumé exécutif</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatTile label="Patrimoine total" value={totalWealth} delta={wealthDelta.total} />
          <StatTile label={`Revenus — ${MONTH_LABELS[CURRENT_MONTH - 1].slice(0, 3)}`} value={currentMonthTotals?.revenus ?? 0} delta={pctDelta(currentMonthTotals?.revenus, beforeCurrent?.revenus)} />
          <StatTile label="Portefeuille (montant investi net)" value={portfolioValue} delta={wealthDelta.invested} />
          <StatTile label={`Dépenses — ${MONTH_LABELS[prevMonth - 1].slice(0, 3)}`} value={lastClosed?.depenses ?? 0} delta={pctDelta(lastClosed?.depenses, beforeLastClosed?.depenses)} higherIsBetter={false} />
          <StatTile label={`Épargne — ${MONTH_LABELS[prevMonth - 1].slice(0, 3)}`} value={lastClosed?.epargne ?? 0} delta={pctDelta(lastClosed?.epargne, beforeLastClosed?.epargne)} />
          <StatTile label={`Taux d'épargne — ${MONTH_LABELS[prevMonth - 1].slice(0, 3)}`} value={lastClosed?.savingsRate ?? 0} isCurrency={false} delta={pctDelta(lastClosed?.savingsRate, beforeLastClosed?.savingsRate)} />
        </div>
        {totalDebtRemaining > 0 && (
          <p className="text-xs text-gray-400">
            Patrimoine net après dettes restantes (<Money value={totalDebtRemaining} />) · <Link href="/dettes" className="text-accent">détail →</Link>
          </p>
        )}

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
      </section>

      {/* Patrimoine */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Patrimoine</h2>

        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-2">Évolution du patrimoine (liquidités + investissements)</p>
          {wealthSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={wealthSeries.map((w) => ({ label: `${MONTH_LABELS[w.month - 1].slice(0, 3)} ${w.year}`, Liquidités: w.liquid, Investissements: w.invested }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <Area type="monotone" dataKey="Liquidités" stackId="1" stroke={WEALTH_COLORS[0]} fill={WEALTH_COLORS[0]} fillOpacity={0.5} />
                <Area type="monotone" dataKey="Investissements" stackId="1" stroke={WEALTH_COLORS[1]} fill={WEALTH_COLORS[1]} fillOpacity={0.5} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 py-10 text-center">
              Renseigne un solde de fin de mois dans /input pour voir cette évolution se construire.
            </p>
          )}
        </div>

        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-2">Évolution du cashflow (revenus, dépenses, net)</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={cashflowSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Line type="monotone" dataKey="Revenus" stroke={POSITIVE} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Dépenses" stroke={NEGATIVE} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Net" stroke={GOLD} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-4">
            <p className="text-sm text-gray-500 mb-2">Répartition actuelle</p>
            {wealthAllocation.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={wealthAllocation} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                    {wealthAllocation.map((_, i) => <Cell key={i} fill={WEALTH_COLORS[i % WEALTH_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400 py-10 text-center">Pas encore de données.</p>
            )}
          </div>
          <div className="card p-6 flex flex-col justify-center gap-4">
            <div>
              <p className="text-sm text-gray-500">Investissements cotés (actions, ETF)</p>
              <p className="text-xl font-semibold"><Money value={listedPortfolioValue} /></p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Investissements non cotés (immobilier, prêts...)</p>
              <p className="text-xl font-semibold"><Money value={privateInvestedValue} /></p>
            </div>
            <Link href="/investments" className="text-accent text-sm font-medium">
              Voir le détail →
            </Link>
          </div>
        </div>
      </section>

      <HouseholdWealth myWealth={totalWealth} />

      <GoalsSection currentWealth={grossAssets} avgMonthlySavings={avgMonthlySavings} />

      {/* Comparaisons entre années */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Comparaisons entre années</h2>
        <div className="card p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={annualData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="year" />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Bar dataKey="Revenus" fill={GROUP_COLORS.revenus} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Dépenses" fill={GROUP_COLORS.fixes} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Épargne" fill={GROUP_COLORS.epargne} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
