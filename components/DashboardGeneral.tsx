"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";
import Link from "next/link";
import StatTile from "@/components/StatTile";
import { Money } from "@/components/BlurToggle";
import { GROUP_COLORS, MONTH_LABELS } from "@/lib/categories";
import {
  Entry, computeMonthTotals, computeRunningBalance, yearTotals, capToCurrentMonth,
} from "@/lib/aggregate";
import { savingsRateTrendInsight, expenseConcentrationInsight, cashflowStreakInsight, Insight } from "@/lib/insights";

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;
const WEALTH_COLORS = ["#1971c2", "#7048e8"];

export default function DashboardGeneral() {
  const [entriesRaw, setEntriesRaw] = useState<Entry[]>([]);
  const [liquidBalance, setLiquidBalance] = useState<number | null>(null);
  const [investedCapital, setInvestedCapital] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/entries")
      .then((r) => r.json())
      .then((data) => { setEntriesRaw(data); setLoading(false); });

    fetch(`/api/balances?year=${CURRENT_YEAR}`)
      .then((r) => r.json())
      .then((balances: any[]) => {
        const valid = balances.filter((b) => b.month <= CURRENT_MONTH && b.endBalance != null);
        const latest = valid.sort((a, b) => b.month - a.month)[0];
        setLiquidBalance(latest?.endBalance ?? null);
      });

    fetch("/api/investments")
      .then((r) => r.json())
      .then(async (txs: any[]) => {
        const currencies = Array.from(new Set(txs.map((t) => t.currency).filter((c: string) => c && c !== "EUR")));
        const rateEntries = await Promise.all(
          currencies.map((c) =>
            fetch(`/api/exchange-rate?from=${c}&to=EUR`).then((r) => (r.ok ? r.json() : { rate: 1 })).then((d) => [c, d.rate ?? 1])
          )
        );
        const rates: Record<string, number> = { EUR: 1, ...Object.fromEntries(rateEntries) };
        const net = txs.reduce((s, t) => {
          const signed = t.type === "vente" ? -t.amount : t.amount;
          return s + signed * (rates[t.currency] ?? 1);
        }, 0);
        setInvestedCapital(net);
      });
  }, []);

  const entries = useMemo(() => capToCurrentMonth(entriesRaw), [entriesRaw]);
  const monthTotals = useMemo(() => computeMonthTotals(entries), [entries]);
  const withBalance = useMemo(() => computeRunningBalance(monthTotals), [monthTotals]);
  const years = Array.from(new Set(monthTotals.map((t) => t.year))).sort();

  const current = monthTotals.find((t) => t.year === CURRENT_YEAR && t.month === CURRENT_MONTH);
  const donutData = useMemo(() => {
    const rows = entries.filter((e) => e.year === CURRENT_YEAR && e.month === CURRENT_MONTH && (e.group === "fixes" || e.group === "variables"));
    return rows.map((r) => ({ name: r.category, value: r.amount }));
  }, [entries]);

  const annualData = useMemo(
    () => years.map((y) => {
      const t = yearTotals(monthTotals, y);
      return { year: y, Revenus: t.revenus, Dépenses: t.depenses, Épargne: t.epargne };
    }),
    [years, monthTotals]
  );

  const insights: Insight[] = useMemo(() => {
    const list: (Insight | null)[] = [
      savingsRateTrendInsight(monthTotals),
      expenseConcentrationInsight(donutData.map((d) => ({ category: d.name, amount: d.value })), current?.depenses ?? 0),
      cashflowStreakInsight(monthTotals),
    ];
    return list.filter((i): i is Insight => i !== null);
  }, [monthTotals, donutData, current]);

  const totalWealth = (liquidBalance ?? 0) + (investedCapital ?? 0);
  const wealthAllocation = [
    { name: "Liquidités", value: Math.max(liquidBalance ?? 0, 0) },
    { name: "Investissements", value: Math.max(investedCapital ?? 0, 0) },
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
      {/* Executive Summary */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Résumé exécutif</h2>
          <p className="text-sm text-gray-400">Situation au {MONTH_LABELS[CURRENT_MONTH - 1]} {CURRENT_YEAR}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Patrimoine total" value={totalWealth} />
          <StatTile label="Solde net du mois" value={current?.net ?? 0} />
          <StatTile label="Taux d'épargne" value={current?.savingsRate ?? 0} isCurrency={false} />
          <StatTile label="Revenus du mois" value={current?.revenus ?? 0} />
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
      </section>

      {/* Patrimoine */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Patrimoine</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-4">
            <p className="text-sm text-gray-500 mb-2">Répartition liquidités / investissements</p>
            {wealthAllocation.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={wealthAllocation} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                    {wealthAllocation.map((_, i) => <Cell key={i} fill={WEALTH_COLORS[i % WEALTH_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400 py-10 text-center">
                Renseigne un solde de fin de mois dans /input et/ou une transaction dans /investments.
              </p>
            )}
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500 mb-2">Solde net cumulé dans le temps</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={withBalance.map((t) => ({ label: `${MONTH_LABELS[t.month - 1].slice(0, 3)} ${t.year}`, balance: t.runningBalance }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} />
                <Line type="monotone" dataKey="balance" stroke="#1971c2" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Capital investi (coût d'acquisition, converti EUR)</p>
            <p className="text-2xl font-semibold"><Money value={investedCapital ?? 0} /></p>
          </div>
          <Link href="/investments" className="text-accent text-sm font-medium">
            Voir le portefeuille en détail →
          </Link>
        </div>
      </section>

      {/* Comparaisons entre années */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Comparaisons entre années</h2>
        <div className="card p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={annualData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="year" />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} />
              <Legend />
              <Bar dataKey="Revenus" fill={GROUP_COLORS.revenus} />
              <Bar dataKey="Dépenses" fill={GROUP_COLORS.fixes} />
              <Bar dataKey="Épargne" fill={GROUP_COLORS.epargne} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
