"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";
import Link from "next/link";
import StatTile from "@/components/StatTile";
import { Money } from "@/components/BlurToggle";
import { MONTH_LABELS } from "@/lib/categories";
import {
  Entry, computeMonthTotals, topExpenses, expensesByCategory, yoyByCategory, momByCategory,
  movingAverage, ytdCumulative, yearTotals, capToCurrentMonth, Balance, sum,
} from "@/lib/aggregate";
import { computeRatios, judgeRatio } from "@/lib/ratios";
import { CATEGORICAL_PALETTE, SLATE, GOLD, POSITIVE, NEGATIVE, INK } from "@/lib/theme";

const TOOLTIP_STYLE = { fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(18,35,63,0.08)" };
const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;
const ALL_MONTHS = "all";

const RATIO_DEFS: { key: keyof ReturnType<typeof computeRatios>; label: string; isPct: boolean; higherIsBetter: boolean }[] = [
  { key: "savingsRate", label: "Savings Rate", isPct: true, higherIsBetter: true },
  { key: "fixedToIncome", label: "Fixed Expenses / Income", isPct: true, higherIsBetter: false },
  { key: "variableToIncome", label: "Variable Expenses / Income", isPct: true, higherIsBetter: false },
  { key: "investmentRate", label: "Investment Rate", isPct: true, higherIsBetter: true },
  { key: "housingRatio", label: "Housing Ratio", isPct: true, higherIsBetter: false },
  { key: "discretionaryExpenses", label: "Dépenses discrétionnaires", isPct: false, higherIsBetter: false },
  { key: "avgMonthlyIncome", label: "Revenu moyen mensuel", isPct: false, higherIsBetter: true },
  { key: "avgSavings", label: "Épargne moyenne", isPct: false, higherIsBetter: true },
  { key: "avgCostOfLiving", label: "Coût moyen de la vie", isPct: false, higherIsBetter: false },
];

const JUDGMENT_STYLE: Record<string, { label: string; className: string }> = {
  good: { label: "Sain", className: "bg-green-50 text-green" },
  neutral: { label: "Correct", className: "bg-[#F5F0E6] text-accent" },
  warning: { label: "À surveiller", className: "bg-red-50 text-red" },
};

export default function DashboardAnalyse() {
  const [entriesRaw, setEntriesRaw] = useState<Entry[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({ EUR: 1 });
  const [loading, setLoading] = useState(true);

  const [selYear, setSelYear] = useState(CURRENT_YEAR);
  const [selMonth, setSelMonth] = useState<number | "all">(CURRENT_MONTH);
  const [selCategory, setSelCategory] = useState<string>("all");
  const [selTag, setSelTag] = useState<string>("all");
  const [selParentGroup, setSelParentGroup] = useState<string>("all");

  useEffect(() => {
    fetch("/api/entries").then((r) => r.json()).then((data) => { setEntriesRaw(data); setLoading(false); });
    fetch("/api/balances").then((r) => r.json()).then(setBalances);
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
    fetch("/api/investments").then((r) => r.json()).then(setTransactions);
  }, []);

  // Taux de change pour les devises utilisées par les transactions boursières
  useEffect(() => {
    const currencies = new Set(transactions.map((t: any) => t.currency).filter((c: string) => c && c !== "EUR"));
    currencies.forEach((c) => {
      if (rates[c] !== undefined) return;
      fetch(`/api/exchange-rate?from=${c}&to=EUR`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setRates((prev) => ({ ...prev, [c]: data?.rate ?? 1 })))
        .catch(() => setRates((prev) => ({ ...prev, [c]: 1 })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  const entries = useMemo(() => capToCurrentMonth(entriesRaw), [entriesRaw]);
  const balancesCapped = useMemo(
    () => balances.filter((b) => b.year < CURRENT_YEAR || (b.year === CURRENT_YEAR && b.month <= CURRENT_MONTH)),
    [balances]
  );
  const monthTotals = useMemo(() => computeMonthTotals(entries, balancesCapped), [entries, balancesCapped]);
  const years = Array.from(new Set(monthTotals.map((t) => t.year))).sort();
  const monthOptions = MONTH_LABELS.filter((_, i) => selYear < CURRENT_YEAR || i + 1 <= CURRENT_MONTH);

  // Liste des catégories (dépenses) disponibles pour le filtre — dérivée des entrées
  // réelles, pour inclure celles qui ont depuis été renommées/arrêtées
  const categoryOptions = useMemo(() => {
    const names = new Set(entries.filter((e) => e.group === "fixes" || e.group === "variables").map((e) => e.category));
    return Array.from(names).sort();
  }, [entries]);

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) for (const t of e.tags ?? []) set.add(t);
    return Array.from(set).sort();
  }, [entries]);

  const parentGroupOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of categories) if (c.parentGroup) set.add(c.parentGroup);
    return Array.from(set).sort();
  }, [categories]);

  // Catégories appartenant au regroupement sélectionné (ex: "Car" -> Carfuel, Carinsurance...)
  const categoriesInParentGroup = useMemo(() => {
    if (selParentGroup === "all") return [];
    return categories.filter((c) => c.parentGroup === selParentGroup).map((c) => c.name);
  }, [categories, selParentGroup]);

  const isWholeYear = selMonth === ALL_MONTHS;
  const current = !isWholeYear ? monthTotals.find((t) => t.year === selYear && t.month === selMonth) : undefined;
  const prevM = !isWholeYear ? (selMonth === 1 ? 12 : (selMonth as number) - 1) : undefined;
  const prevY = !isWholeYear ? (selMonth === 1 ? selYear - 1 : selYear) : undefined;
  const previous = !isWholeYear ? monthTotals.find((t) => t.year === prevY && t.month === prevM) : undefined;
  const revenusDelta = previous && previous.revenus ? ((current?.revenus ?? 0) - previous.revenus) / previous.revenus * 100 : null;
  const depensesDelta = previous && previous.depenses ? ((current?.depenses ?? 0) - previous.depenses) / previous.depenses * 100 : null;

  const donutData = useMemo(() => {
    if (isWholeYear) return [];
    const rows = expensesByCategory(entries, selYear, selMonth as number);
    return rows.map((r) => ({ name: r.category, value: r.amount }));
  }, [entries, selYear, selMonth, isWholeYear]);

  const top5 = useMemo(() => isWholeYear ? [] : topExpenses(entries, selYear, selMonth as number, 5), [entries, selYear, selMonth, isWholeYear]);
  const yoyData = useMemo(() => isWholeYear ? [] : yoyByCategory(entries, selYear, selMonth as number), [entries, selYear, selMonth, isWholeYear]);
  const movers = useMemo(() => isWholeYear ? [] : momByCategory(entries, selYear, selMonth as number).slice(0, 8), [entries, selYear, selMonth, isWholeYear]);

  // Vue annuelle
  const yearMonths = useMemo(() => monthTotals.filter((t) => t.year === selYear).sort((a, b) => a.month - b.month), [monthTotals, selYear]);
  const yearSummary = useMemo(() => yearTotals(monthTotals, selYear), [monthTotals, selYear]);
  const avgSavingsRateYear = yearMonths.length ? sum(yearMonths.map((t) => t.savingsRate)) / yearMonths.length : 0;
  const savingsRateSeries = useMemo(() => {
    const rates = yearMonths.map((t) => t.savingsRate);
    const ma = movingAverage(rates, 3);
    return yearMonths.map((t, i) => ({ label: MONTH_LABELS[t.month - 1].slice(0, 3), rate: Number(t.savingsRate.toFixed(1)), ma3: Number(ma[i].toFixed(1)) }));
  }, [yearMonths]);
  const ytdCurrent = useMemo(() => ytdCumulative(monthTotals, selYear, "epargne"), [monthTotals, selYear]);
  const ytdPrevious = useMemo(() => ytdCumulative(monthTotals, selYear - 1, "epargne"), [monthTotals, selYear]);
  const ytdCombined = MONTH_LABELS.map((label, i) => ({
    label: label.slice(0, 3),
    [`${selYear}`]: ytdCurrent.find((y) => y.month === i + 1)?.cumulative ?? null,
    [`${selYear - 1}`]: ytdPrevious.find((y) => y.month === i + 1)?.cumulative ?? null,
  }));

  // Focus catégorie : tendance de la catégorie sélectionnée sur toute la période connue
  const categoryTrend = useMemo(() => {
    if (selCategory === "all") return [];
    return monthTotals.map((t) => {
      const amt = entries.filter((e) => e.year === t.year && e.month === t.month && e.category === selCategory).reduce((s, e) => s + e.amount, 0);
      return { label: `${MONTH_LABELS[t.month - 1].slice(0, 3)} ${t.year}`, montant: amt };
    });
  }, [monthTotals, entries, selCategory]);
  const categoryThisPeriod = useMemo(() => {
    if (selCategory === "all") return 0;
    const rows = isWholeYear
      ? entries.filter((e) => e.year === selYear && e.category === selCategory)
      : entries.filter((e) => e.year === selYear && e.month === selMonth && e.category === selCategory);
    return rows.reduce((s, e) => s + e.amount, 0);
  }, [entries, selCategory, selYear, selMonth, isWholeYear]);
  const categoryLastPeriod = useMemo(() => {
    if (selCategory === "all") return 0;
    const rows = isWholeYear
      ? entries.filter((e) => e.year === selYear - 1 && e.category === selCategory)
      : entries.filter((e) => e.year === prevY && e.month === prevM && e.category === selCategory);
    return rows.reduce((s, e) => s + e.amount, 0);
  }, [entries, selCategory, selYear, isWholeYear, prevY, prevM]);

  // Focus tag : tendance du tag sélectionné sur toute la période connue
  const tagTrend = useMemo(() => {
    if (selTag === "all") return [];
    return monthTotals.map((t) => {
      const amt = entries.filter((e) => e.year === t.year && e.month === t.month && (e.tags ?? []).includes(selTag)).reduce((s, e) => s + e.amount, 0);
      return { label: `${MONTH_LABELS[t.month - 1].slice(0, 3)} ${t.year}`, montant: amt };
    });
  }, [monthTotals, entries, selTag]);
  const tagThisPeriod = useMemo(() => {
    if (selTag === "all") return 0;
    const rows = isWholeYear
      ? entries.filter((e) => e.year === selYear && (e.tags ?? []).includes(selTag))
      : entries.filter((e) => e.year === selYear && e.month === selMonth && (e.tags ?? []).includes(selTag));
    return rows.reduce((s, e) => s + e.amount, 0);
  }, [entries, selTag, selYear, selMonth, isWholeYear]);
  const tagBreakdown = useMemo(() => {
    if (selTag === "all") return [];
    const rows = isWholeYear
      ? entries.filter((e) => e.year === selYear && (e.tags ?? []).includes(selTag))
      : entries.filter((e) => e.year === selYear && e.month === selMonth && (e.tags ?? []).includes(selTag));
    const byCategory = new Map<string, number>();
    for (const r of rows) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.amount);
    return Array.from(byCategory.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [entries, selTag, selYear, selMonth, isWholeYear]);

  // Focus regroupement : tendance de toutes les catégories du regroupement sélectionné
  const parentGroupTrend = useMemo(() => {
    if (selParentGroup === "all") return [];
    return monthTotals.map((t) => {
      const amt = entries.filter((e) => e.year === t.year && e.month === t.month && categoriesInParentGroup.includes(e.category)).reduce((s, e) => s + e.amount, 0);
      return { label: `${MONTH_LABELS[t.month - 1].slice(0, 3)} ${t.year}`, montant: amt };
    });
  }, [monthTotals, entries, selParentGroup, categoriesInParentGroup]);
  const parentGroupThisPeriod = useMemo(() => {
    if (selParentGroup === "all") return 0;
    const rows = isWholeYear
      ? entries.filter((e) => e.year === selYear && categoriesInParentGroup.includes(e.category))
      : entries.filter((e) => e.year === selYear && e.month === selMonth && categoriesInParentGroup.includes(e.category));
    return rows.reduce((s, e) => s + e.amount, 0);
  }, [entries, selParentGroup, categoriesInParentGroup, selYear, selMonth, isWholeYear]);
  const parentGroupBreakdown = useMemo(() => {
    if (selParentGroup === "all") return [];
    const rows = isWholeYear
      ? entries.filter((e) => e.year === selYear && categoriesInParentGroup.includes(e.category))
      : entries.filter((e) => e.year === selYear && e.month === selMonth && categoriesInParentGroup.includes(e.category));
    const byCategory = new Map<string, number>();
    for (const r of rows) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.amount);
    return Array.from(byCategory.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [entries, selParentGroup, categoriesInParentGroup, selYear, selMonth, isWholeYear]);

  // Ratios sur l'année sélectionnée
  const ratios = useMemo(() => {
    const yearTransactions = transactions.filter((t: any) => new Date(t.date).getFullYear() === selYear);
    return computeRatios(yearMonths, entries.filter((e) => e.year === selYear), categories, yearTransactions, rates);
  }, [yearMonths, entries, selYear, categories, transactions, rates]);
  const prevYearMonthsForRatios = useMemo(() => monthTotals.filter((t) => t.year === selYear - 1), [monthTotals, selYear]);
  const prevYearRatios = useMemo(() => {
    if (prevYearMonthsForRatios.length === 0) return null;
    const prevYearTransactions = transactions.filter((t: any) => new Date(t.date).getFullYear() === selYear - 1);
    return computeRatios(prevYearMonthsForRatios, entries.filter((e) => e.year === selYear - 1), categories, prevYearTransactions, rates);
  }, [prevYearMonthsForRatios, entries, selYear, categories, transactions, rates]);

  if (loading) return <p className="text-gray-500">Chargement...</p>;
  if (entries.length === 0) {
    return <p className="text-gray-500">Aucune donnée pour le moment. Commence par une <Link href="/input" className="text-accent">saisie mensuelle</Link>.</p>;
  }

  return (
    <div className="space-y-10">
      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center card p-4">
        <span className="text-sm text-gray-400">Filtrer :</span>
        <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={selMonth} onChange={(e) => setSelMonth(e.target.value === ALL_MONTHS ? ALL_MONTHS : Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value={ALL_MONTHS}>Toute l'année</option>
          {monthOptions.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={selCategory} onChange={(e) => setSelCategory(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="all">Toutes catégories</option>
          {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {tagOptions.length > 0 && (
          <select value={selTag} onChange={(e) => setSelTag(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="all">Tous les tags</option>
            {tagOptions.map((t) => <option key={t} value={t}>#{t}</option>)}
          </select>
        )}
        {parentGroupOptions.length > 0 && (
          <select value={selParentGroup} onChange={(e) => setSelParentGroup(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="all">Tous les regroupements</option>
            {parentGroupOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {/* Focus catégorie */}
      {selCategory !== "all" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Focus — {selCategory}</h2>
          <div className="grid grid-cols-2 gap-4">
            <StatTile label={isWholeYear ? `${selYear}` : `${MONTH_LABELS[(selMonth as number) - 1]} ${selYear}`} value={categoryThisPeriod} />
            <StatTile label={isWholeYear ? `${selYear - 1}` : "Même mois, année précédente"} value={categoryLastPeriod} />
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500 mb-2">Évolution de "{selCategory}" dans le temps</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={categoryTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="montant" stroke={GOLD} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Focus tag */}
      {selTag !== "all" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Focus — #{selTag}</h2>
          <StatTile label={isWholeYear ? `Total ${selYear}` : `${MONTH_LABELS[(selMonth as number) - 1]} ${selYear}`} value={tagThisPeriod} />
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card p-4">
              <p className="text-sm text-gray-500 mb-2">Évolution de "#{selTag}" dans le temps</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={tagTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="montant" stroke={GOLD} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500 mb-2">Répartition par catégorie</p>
              <ul className="space-y-2">
                {tagBreakdown.map((r) => (
                  <li key={r.category} className="flex justify-between text-sm border-b border-gray-100 pb-2">
                    <span>{r.category}</span>
                    <Money value={r.amount} />
                  </li>
                ))}
                {tagBreakdown.length === 0 && <li className="text-gray-400 text-sm">Aucune dépense avec ce tag sur la période</li>}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Focus regroupement */}
      {selParentGroup !== "all" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Focus — {selParentGroup} ({categoriesInParentGroup.join(", ")})</h2>
          <StatTile label={isWholeYear ? `Total ${selYear}` : `${MONTH_LABELS[(selMonth as number) - 1]} ${selYear}`} value={parentGroupThisPeriod} />
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card p-4">
              <p className="text-sm text-gray-500 mb-2">Évolution de "{selParentGroup}" dans le temps</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={parentGroupTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="montant" stroke={GOLD} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500 mb-2">Répartition par catégorie</p>
              <ul className="space-y-2">
                {parentGroupBreakdown.map((r) => (
                  <li key={r.category} className="flex justify-between text-sm border-b border-gray-100 pb-2">
                    <span>{r.category}</span>
                    <Money value={r.amount} />
                  </li>
                ))}
                {parentGroupBreakdown.length === 0 && <li className="text-gray-400 text-sm">Aucune dépense dans ce regroupement sur la période</li>}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Vue mensuelle */}
      {!isWholeYear && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatTile label="Solde net du mois" value={current?.net ?? 0} />
            <StatTile label="Taux d'épargne" value={current?.savingsRate ?? 0} isCurrency={false} />
            <StatTile label="Revenus" value={current?.revenus ?? 0} delta={revenusDelta} />
            <StatTile label="Dépenses" value={current?.depenses ?? 0} delta={depensesDelta} higherIsBetter={false} />
          </div>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{MONTH_LABELS[(selMonth as number) - 1]} {selYear}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card p-4">
                <p className="text-sm text-gray-500 mb-2">Répartition des dépenses</p>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} label={({ name, percent }) => percent > 0.06 ? name : ""} labelLine={false}>
                      {donutData.map((_, i) => <Cell key={i} fill={CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
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
              <p className="text-sm text-gray-500 mb-2">Plus fortes variations vs {MONTH_LABELS[(prevM as number) - 1]}</p>
              {movers.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(180, movers.length * 34)}>
                  <BarChart data={movers} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip formatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="delta" radius={[0, 4, 4, 0]}>
                      {movers.map((m, i) => <Cell key={i} fill={m.delta > 0 ? NEGATIVE : POSITIVE} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 py-6 text-center">Pas assez d'historique pour comparer.</p>}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Comparaison année sur année — {MONTH_LABELS[(selMonth as number) - 1]}</h2>
            <div className="card p-4">
              {yoyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(280, yoyData.length * 36)}>
                  <BarChart data={yoyData} layout="vertical" margin={{ left: 10 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={120} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="previous" name={`${selYear - 1}`} fill={SLATE} radius={[0, 3, 3, 0]} />
                    <Bar dataKey="current" name={`${selYear}`} fill={GOLD} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 py-6 text-center">Pas de données à comparer pour {MONTH_LABELS[(selMonth as number) - 1]} l'an dernier.</p>}
            </div>
          </section>
        </>
      )}

      {/* Vue annuelle */}
      {isWholeYear && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatTile label={`Total épargné en ${selYear}`} value={yearSummary.epargne} />
            <StatTile label="Taux d'épargne moyen" value={avgSavingsRateYear} isCurrency={false} />
            <StatTile label="Revenus de l'année" value={yearSummary.revenus} />
            <StatTile label="Dépenses de l'année" value={yearSummary.depenses} />
          </div>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Évolution mensuelle — {selYear}</h2>
            <div className="card p-4">
              <p className="text-sm text-gray-500 mb-2">Taux d'épargne (%) — moyenne mobile 3 mois</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={savingsRateSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="rate" stroke={SLATE} dot={false} name="Taux mensuel" />
                  <Line type="monotone" dataKey="ma3" stroke={GOLD} strokeWidth={2} dot={false} name="Moy. mobile 3 mois" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Cumul d'épargne — {selYear} vs {selYear - 1}</h2>
            <p className="text-xs text-gray-400 -mt-3">Épargne réelle cumulée depuis janvier</p>
            <div className="card p-4">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={ytdCombined}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey={`${selYear}`} stroke={INK} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={`${selYear - 1}`} stroke={SLATE} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}

      {/* Ratios & indicateurs */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Ratios & indicateurs — {selYear}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {RATIO_DEFS.map((r) => {
            const value = ratios[r.key];
            const judgment = r.isPct ? judgeRatio(r.key, value) : null;
            const prevValue = prevYearRatios ? prevYearRatios[r.key] : null;
            const delta = prevValue != null ? value - prevValue : null;
            const deltaFavorable = delta != null ? (r.higherIsBetter ? delta >= 0 : delta <= 0) : null;
            return (
              <div key={r.key} className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{r.label}</p>
                  {judgment && (
                    <span className={`text-xs px-2 py-0.5 rounded ${JUDGMENT_STYLE[judgment].className}`}>
                      {JUDGMENT_STYLE[judgment].label}
                    </span>
                  )}
                </div>
                <p className="text-xl font-semibold mt-1">
                  {r.isPct ? `${value.toFixed(1)}%` : <Money value={value} />}
                </p>
                {delta != null && Math.abs(delta) > 0.05 && (
                  <p className={`text-xs mt-1 ${deltaFavorable ? "text-green" : "text-red"}`}>
                    {delta >= 0 ? "↑" : "↓"} {r.isPct ? `${Math.abs(delta).toFixed(1)} pt` : <Money value={Math.abs(delta)} />} vs {selYear - 1}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
