"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis,
} from "recharts";
import Link from "next/link";
import StatTile from "@/components/StatTile";
import { Money } from "@/components/BlurToggle";
import { GROUP_COLORS, MONTH_LABELS } from "@/lib/categories";
import {
  Entry, computeMonthTotals, topExpenses, expensesByCategory, yoyByCategory, capToCurrentMonth, Balance,
} from "@/lib/aggregate";

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;
import { CATEGORICAL_PALETTE, SLATE, GOLD } from "@/lib/theme";

const TOOLTIP_STYLE = { fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(18,35,63,0.08)" };

export default function DashboardMonthly() {
  const [entriesRaw, setEntriesRaw] = useState<Entry[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selYear, setSelYear] = useState(CURRENT_YEAR);
  const [selMonth, setSelMonth] = useState(CURRENT_MONTH);

  useEffect(() => {
    fetch("/api/entries").then((r) => r.json()).then((data) => { setEntriesRaw(data); setLoading(false); });
    fetch("/api/balances").then((r) => r.json()).then(setBalances);
  }, []);

  const entries = useMemo(() => capToCurrentMonth(entriesRaw), [entriesRaw]);
  const balancesCapped = useMemo(
    () => balances.filter((b) => b.year < CURRENT_YEAR || (b.year === CURRENT_YEAR && b.month <= CURRENT_MONTH)),
    [balances]
  );
  const monthTotals = useMemo(() => computeMonthTotals(entries, balancesCapped), [entries, balancesCapped]);
  const years = Array.from(new Set(monthTotals.map((t) => t.year))).sort();
  const monthOptions = MONTH_LABELS.filter((_, i) => selYear < CURRENT_YEAR || i + 1 <= CURRENT_MONTH);

  const current = monthTotals.find((t) => t.year === selYear && t.month === selMonth);
  const prevM = selMonth === 1 ? 12 : selMonth - 1;
  const prevY = selMonth === 1 ? selYear - 1 : selYear;
  const previous = monthTotals.find((t) => t.year === prevY && t.month === prevM);

  const revenusDelta = previous && previous.revenus ? ((current?.revenus ?? 0) - previous.revenus) / previous.revenus * 100 : null;
  const depensesDelta = previous && previous.depenses ? ((current?.depenses ?? 0) - previous.depenses) / previous.depenses * 100 : null;

  const donutData = useMemo(() => {
    const rows = expensesByCategory(entries, selYear, selMonth);
    return rows.map((r) => ({ name: r.category, value: r.amount }));
  }, [entries, selYear, selMonth]);

  const top5 = useMemo(() => topExpenses(entries, selYear, selMonth, 5), [entries, selYear, selMonth]);
  const yoyData = useMemo(() => yoyByCategory(entries, selYear, selMonth), [entries, selYear, selMonth]);

  if (loading) return <p className="text-gray-500">Chargement...</p>;
  if (entries.length === 0) {
    return (
      <p className="text-gray-500">
        Aucune donnée pour le moment. Commence par une <Link href="/input" className="text-accent">saisie mensuelle</Link>.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex gap-3 items-center">
        <select value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2">
          {monthOptions.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Solde net du mois" value={current?.net ?? 0} />
        <StatTile label="Taux d'épargne" value={current?.savingsRate ?? 0} isCurrency={false} />
        <StatTile label="Revenus" value={current?.revenus ?? 0} delta={revenusDelta} />
        <StatTile label="Dépenses" value={current?.depenses ?? 0} delta={depensesDelta} />
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{MONTH_LABELS[selMonth - 1]} {selYear}</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-4">
            <p className="text-sm text-gray-500 mb-2">Répartition des dépenses</p>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
                  {donutData.map((_, i) => <Cell key={i} fill={CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500 mb-2">Top 5 postes de dépense</p>
            <ul className="space-y-2">
              {top5.map((e, i) => (
                <li key={i} className="flex justify-between text-sm border-b border-gray-100 pb-2">
                  <span>{e.category}</span>
                  <Money value={e.amount} />
                </li>
              ))}
              {top5.length === 0 && <li className="text-gray-400 text-sm">Aucune dépense saisie</li>}
            </ul>
          </div>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-2">Revenus / Dépenses / Épargne</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={[{ label: MONTH_LABELS[selMonth - 1].slice(0, 3), Revenus: current?.revenus ?? 0, Dépenses: current?.depenses ?? 0, Épargne: current?.epargne ?? 0 }]} barGap={8}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Bar dataKey="Revenus" fill={GROUP_COLORS.revenus} radius={[4, 4, 0, 0]} maxBarSize={64} />
              <Bar dataKey="Dépenses" fill={GROUP_COLORS.fixes} radius={[4, 4, 0, 0]} maxBarSize={64} />
              <Bar dataKey="Épargne" fill={GROUP_COLORS.epargne} radius={[4, 4, 0, 0]} maxBarSize={64} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Comparaison année sur année — {MONTH_LABELS[selMonth - 1]}</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={yoyData}>
                <XAxis dataKey="category" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <Bar dataKey="previous" name={`${selYear - 1}`} fill={SLATE} radius={[3, 3, 0, 0]} />
                <Bar dataKey="current" name={`${selYear}`} fill={GOLD} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-4 overflow-y-auto max-h-[320px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left border-b border-gray-100">
                  <th className="py-2">Catégorie</th>
                  <th className="text-right">Variation</th>
                </tr>
              </thead>
              <tbody>
                {yoyData.map((r) => (
                  <tr key={r.category} className="border-b border-gray-50">
                    <td className="py-2">{r.category}</td>
                    <td className={`text-right ${r.deltaPct >= 0 ? "text-green" : "text-red"}`}>
                      {r.deltaPct >= 0 ? "↑" : "↓"} {Math.abs(r.deltaPct).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
