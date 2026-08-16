"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  AreaChart, Area, LineChart, Line, CartesianGrid, XAxis, YAxis,
} from "recharts";
import Link from "next/link";
import { Money } from "@/components/BlurToggle";
import StatTile from "@/components/StatTile";
import { MONTH_LABELS } from "@/lib/categories";
import { computeWealthEvolution } from "@/lib/wealth";
import { useWealthSnapshot } from "@/lib/useWealthSnapshot";
import HouseholdWealth from "@/components/HouseholdWealth";
import { WEALTH_PALETTE, GOLD, POSITIVE, NEGATIVE } from "@/lib/theme";

const WEALTH_COLORS = WEALTH_PALETTE;
const TOOLTIP_STYLE = { fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(18,35,63,0.08)" };

export default function PatrimoineEnsemble() {
  const {
    loading, entries, monthTotals, balancesCapped, transactions, rates,
    liquidBalance, listedPortfolioValue, privateInvestedValue, portfolioValue, totalDebtRemaining, totalWealth,
  } = useWealthSnapshot();

  const wealthSeries = useMemo(
    () => computeWealthEvolution(balancesCapped, transactions, rates),
    [balancesCapped, transactions, rates]
  );
  const cashflowSeries = useMemo(
    () => monthTotals.map((t) => ({
      label: `${MONTH_LABELS[t.month - 1].slice(0, 3)} ${t.year}`,
      Revenus: t.revenus,
      Dépenses: t.depenses,
      Net: t.net,
    })),
    [monthTotals]
  );

  const wealthAllocation = [
    { name: "Liquidités", value: Math.max(liquidBalance ?? 0, 0) },
    { name: "Investissements", value: Math.max(portfolioValue, 0) },
  ].filter((w) => w.value > 0);

  if (loading) return <p className="text-gray-500">Chargement...</p>;
  if (entries.length === 0) {
    return <p className="text-gray-500">Aucune donnée pour le moment. Commence par une <Link href="/input" className="text-accent">saisie mensuelle</Link>.</p>;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatTile label="Patrimoine net" value={totalWealth} />
        <StatTile label="Portefeuille (montant investi net)" value={portfolioValue} />
        <StatTile label="Liquidités" value={liquidBalance ?? 0} />
      </div>
      {totalDebtRemaining > 0 && (
        <p className="text-xs text-gray-400">
          Patrimoine net après dettes restantes (<Money value={totalDebtRemaining} />) · <Link href="/patrimoine/dettes" className="text-accent">détail →</Link>
        </p>
      )}

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
          <Link href="/patrimoine/investissements" className="text-accent text-sm font-medium">
            Voir le détail →
          </Link>
        </div>
      </div>

      <HouseholdWealth myWealth={totalWealth} />
    </div>
  );
}
