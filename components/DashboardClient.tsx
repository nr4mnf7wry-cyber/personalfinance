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
import { savingsRateTrendInsight, expenseConcentrationInsight, cashflowStreakInsight, Insight } from "@/lib/insights";

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;
const CATEGORY_COLORS = ["#1971c2", "#e8590c", "#2f9e44", "#7048e8", "#e03131", "#f08c00", "#0ca678", "#495057"];
const WEALTH_COLORS = ["#1971c2", "#7048e8"];

export default function DashboardClient() {
  const [entriesRaw, setEntriesRaw] = useState<Entry[]>([]);
  const [liquidBalance, setLiquidBalance] = useState<number | null>(null);
  const [investedCapital, setInvestedCapital] = useState<number | null>(null);
  const [selYear, setSelYear] = useState(CURRENT_YEAR);
  const [selMonth, setSelMonth] = useState(CURRENT_MONTH);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/entries")
      .then((r) => r.json())
      .then((data) => { setEntriesRaw(data); setLoading(false); });

    // Solde liquide = dernier solde de fin de mois renseigné (le plus récent, pas au-delà d'aujourd'hui)
    fetch(`/api/balances?year=${CURRENT_YEAR}`)
      .then((r) => r.json())
      .then((balances: any[]) => {
        const valid = balances.filter((b) => b.month <= CURRENT_MONTH && b.endBalance != null);
        const latest = valid.sort((a, b) => b.month - a.month)[0];
        setLiquidBalance(latest?.endBalance ?? null);
      });

    // Capital investi (coût d'acquisition net, converti en EUR) — valorisation en direct sur /investments
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

  // Plafonne toutes les données au mois réel en cours — pas de mois futurs affichés
  // comme s'ils étaient réels (cf. saisies accidentelles ou pré-remplissage passé)
  const entries = useMemo(
    () => entriesRaw.filter((e) => e.year < CURRENT_YEAR || (e.year === CURRENT_YEAR && e.month <= CURRENT_MONTH)),
    [entriesRaw]
  );

  const monthTotals = useMemo(() => computeMonthTotals(entries), [entries]);
  const withBalance = useMemo(() => computeRunningBalance(monthTotals), [monthTotals]);

  const current = monthTotals.find((t) => t.year === selYear && t.month === selMonth);
  const prevM = selMonth === 1 ? 12 : selMonth - 1;
  const prevY = selMonth === 1 ? selYear - 1 : selYear;
  const previous = monthTotals.find((t) => t.year === prevY && t.month === prevM);

  const revenusDelta = previous && previous.revenus ? ((current?.revenus ?? 0) - previous.revenus) / previous.revenus * 100 : null;
  const depensesDelta = previous && previous.depenses ? ((current?.depenses ?? 0) - previous.depenses) / previous.depenses * 100 : null;

  const years = Array.from(new Set(monthTotals.map((t) => t.year))).sort();
  // Les mois sélectionnables ne dépassent jamais le mois réel en cours
  const monthOptions = MONTH_LABELS.filter((_, i) => selYear < CURRENT_YEAR || i + 1 <= CURRENT_MONTH);

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

  // Executive summary — insights réellement calculés à partir des données
  const insights: Insight[] = useMemo(() => {
    const list: (Insight | null)[] = [
      savingsRateTrendInsight(monthTotals),
      expenseConcentrationInsight(donutData.map((d) => ({ category: d.name, amount: d.value })), (current?.depenses ?? 0)),
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Résumé exécutif</h2>
            <p className="text-sm text-gray-400">Situation au {MONTH_LABELS[CURRENT_MONTH - 1]} {CURRENT_YEAR}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Patrimoine total" value={totalWealth} />
          <StatTile label="Solde net du mois" value={current?.net ?? 0} />
          <StatTile label="Taux d'épargne" value={current?.savingsRate ?? 0} isCurrency={false} />
          <StatTile label="Revenus du mois" value={current?.revenus ?? 0} delta={revenusDelta} />
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

      {/* Sélecteur de période pour les sections détaillées ci-dessous */}
      <div className="flex gap-3 items-center">
        <span className="text-sm text-gray-400">Période détaillée :</span>
        <select value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2">
          {monthOptions.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* A. Patrimoine */}
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

      {/* B. Discipline de cash-flow */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Discipline de cash-flow</h2>
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

      {/* C. Structure des dépenses (mois sélectionné) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Structure des dépenses — {MONTH_LABELS[selMonth - 1]} {selYear}</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-4">
            <p className="text-sm text-gray-500 mb-2">Répartition par catégorie</p>
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
      </section>

      {/* D. Vue annuelle */}
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

      {/* E. YoY */}
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
    </div>
  );
}
