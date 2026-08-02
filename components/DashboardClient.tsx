"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, AreaChart, Area,
} from "recharts";
import Link from "next/link";
import StatTile from "@/components/StatTile";
import { Money } from "@/components/BlurToggle";
import { GROUP_COLORS, MONTH_LABELS } from "@/lib/categories";
import {
  Entry, computeMonthTotals, computeRunningBalance, movingAverage,
  topExpenses, expensesByCategory, yearTotals, yoyByCategory, ytdCumulative,
} from "@/lib/aggregate";

const now = new Date();
const CATEGORY_COLORS = ["#1971c2", "#e8590c", "#2f9e44", "#7048e8", "#e03131", "#f08c00", "#0ca678", "#495057"];

export default function DashboardClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [portfolio, setPortfolio] = useState<{ value: number; gain: number } | null>(null);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/entries")
      .then((r) => r.json())
      .then((data) => { setEntries(data); setLoading(false); });

    fetch("/api/investments")
      .then((r) => r.json())
      .then((txs: any[]) => {
        const value = txs.reduce((s, t) => s + t.amount, 0);
        setPortfolio({ value, gain: 0 }); // le +/- value réel se calcule sur /investments avec les cours live
      });
  }, []);

  const monthTotals = useMemo(() => computeMonthTotals(entries), [entries]);
  const withBalance = useMemo(() => computeRunningBalance(monthTotals), [monthTotals]);

  const current = monthTotals.find((t) => t.year === selYear && t.month === selMonth);
  const prevM = selMonth === 1 ? 12 : selMonth - 1;
  const prevY = selMonth === 1 ? selYear - 1 : selYear;
  const previous = monthTotals.find((t) => t.year === prevY && t.month === prevM);

  const revenusDelta = previous && previous.revenus ? ((current?.revenus ?? 0) - previous.revenus) / previous.revenus * 100 : null;
  const depensesDelta = previous && previous.depenses ? ((current?.depenses ?? 0) - previous.depenses) / previous.depenses * 100 : null;

  const years = Array.from(new Set(monthTotals.map((t) => t.year))).sort();

  const donutData = useMemo(() => {
    const rows = expensesByCategory(entries, selYear, selMonth);
    return rows.map((r) => ({ name: r.category, value: r.amount }));
  }, [entries, selYear, selMonth]);

  const top5 = useMemo(() => topExpenses(entries, selYear, selMonth, 5), [entries, selYear, selMonth]);

  const savingsRateSeries = useMemo(() => {
    const rates = monthTotals.map((t) => t.savingsRate);
    const ma = movingAverage(rates, 3);
    return monthTotals.map((t, i) => ({
      label: `${MONTH_LABELS[t.month - 1].slice(0, 3)} ${t.year}`,
      rate: Number(t.savingsRate.toFixed(1)),
      ma3: Number(ma[i].toFixed(1)),
    }));
  }, [monthTotals]);

  const annualData = useMemo(
    () => years.map((y) => {
      const t = yearTotals(monthTotals, y);
      return { year: y, Revenus: t.revenus, Dépenses: t.depenses, Épargne: t.epargne };
    }),
    [years, monthTotals]
  );

  const yoyData = useMemo(() => yoyByCategory(entries, selYear, selMonth), [entries, selYear, selMonth]);

  const ytdCurrent = useMemo(() => ytdCumulative(monthTotals, selYear), [monthTotals, selYear]);
  const ytdPrevious = useMemo(() => ytdCumulative(monthTotals, selYear - 1), [monthTotals, selYear]);
  const ytdCombined = MONTH_LABELS.map((label, i) => ({
    label: label.slice(0, 3),
    [`${selYear}`]: ytdCurrent.find((y) => y.month === i + 1)?.cumulative ?? null,
    [`${selYear - 1}`]: ytdPrevious.find((y) => y.month === i + 1)?.cumulative ?? null,
  }));

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
      {/* Sélecteur de période global */}
      <div className="flex gap-3">
        <select value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2">
          {MONTH_LABELS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Solde net du mois" value={current?.net ?? 0} />
        <StatTile label="Taux d'épargne" value={current?.savingsRate ?? 0} isCurrency={false} />
        <StatTile label="Revenus" value={current?.revenus ?? 0} delta={revenusDelta} />
        <StatTile label="Dépenses" value={current?.depenses ?? 0} delta={depensesDelta} />
      </div>

      {/* A. Vue mensuelle */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Vue mensuelle — {MONTH_LABELS[selMonth - 1]} {selYear}</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-4">
            <p className="text-sm text-gray-500 mb-2">Répartition des dépenses</p>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
                  {donutData.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} />
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
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[{ label: "Mois", Revenus: current?.revenus ?? 0, Dépenses: current?.depenses ?? 0, Épargne: current?.epargne ?? 0 }]} layout="vertical">
              <XAxis type="number" />
              <YAxis type="category" dataKey="label" hide />
              <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} />
              <Legend />
              <Bar dataKey="Revenus" stackId="a" fill={GROUP_COLORS.revenus} />
              <Bar dataKey="Dépenses" stackId="a" fill={GROUP_COLORS.fixes} />
              <Bar dataKey="Épargne" stackId="a" fill={GROUP_COLORS.epargne} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* B. Évolution dans le temps */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Évolution dans le temps</h2>

        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-2">Solde net cumulé (patrimoine dans le temps)</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={withBalance.map((t) => ({ label: `${MONTH_LABELS[t.month - 1].slice(0, 3)} ${t.year}`, balance: t.runningBalance }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} />
              <Line type="monotone" dataKey="balance" stroke="#1971c2" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-4">
            <p className="text-sm text-gray-500 mb-2">Revenus vs Dépenses vs Épargne</p>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthTotals.map((t) => ({ label: `${MONTH_LABELS[t.month - 1].slice(0, 3)} ${t.year}`, Revenus: t.revenus, Dépenses: t.depenses, Épargne: t.epargne }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="Revenus" stackId="1" stroke={GROUP_COLORS.revenus} fill={GROUP_COLORS.revenus} fillOpacity={0.5} />
                <Area type="monotone" dataKey="Dépenses" stackId="2" stroke={GROUP_COLORS.fixes} fill={GROUP_COLORS.fixes} fillOpacity={0.5} />
                <Area type="monotone" dataKey="Épargne" stackId="2" stroke={GROUP_COLORS.epargne} fill={GROUP_COLORS.epargne} fillOpacity={0.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-4">
            <p className="text-sm text-gray-500 mb-2">Taux d'épargne (%) — moyenne mobile 3 mois</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={savingsRateSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="rate" stroke="#adb5bd" dot={false} name="Taux mensuel" />
                <Line type="monotone" dataKey="ma3" stroke="#7048e8" strokeWidth={2} dot={false} name="Moy. mobile 3 mois" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-2">Dépenses fixes vs variables</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthTotals.map((t) => ({ label: `${MONTH_LABELS[t.month - 1].slice(0, 3)} ${t.year}`, Fixes: t.fixes, Variables: t.variables }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Fixes" stackId="a" fill={GROUP_COLORS.fixes} />
              <Bar dataKey="Variables" stackId="a" fill={GROUP_COLORS.variables} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* C. Vue annuelle */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Vue annuelle</h2>
        <div className="card p-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={annualData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="year" />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Revenus" fill={GROUP_COLORS.revenus} />
              <Bar dataKey="Dépenses" fill={GROUP_COLORS.fixes} />
              <Bar dataKey="Épargne" fill={GROUP_COLORS.epargne} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* D. YoY */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Comparaison année sur année — {MONTH_LABELS[selMonth - 1]}</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={yoyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="category" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="previous" name={`${selYear - 1}`} fill="#adb5bd" />
                <Bar dataKey="current" name={`${selYear}`} fill="#1971c2" />
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

        <div className="card p-4">
          <p className="text-sm text-gray-500 mb-2">Cumul YTD — {selYear} vs {selYear - 1}</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={ytdCombined}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={`${selYear}`} stroke="#1971c2" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey={`${selYear - 1}`} stroke="#adb5bd" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* E. Widget investissements */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Investissements</h2>
        <div className="card p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Valeur totale investie</p>
            <p className="text-2xl font-semibold"><Money value={portfolio?.value ?? 0} /></p>
          </div>
          <Link href="/investments" className="text-accent text-sm font-medium">
            Voir le détail →
          </Link>
        </div>
      </section>
    </div>
  );
}
