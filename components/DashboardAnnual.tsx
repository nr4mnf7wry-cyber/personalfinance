"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line,
} from "recharts";
import Link from "next/link";
import StatTile from "@/components/StatTile";
import { Money } from "@/components/BlurToggle";
import { GROUP_COLORS, MONTH_LABELS } from "@/lib/categories";
import {
  Entry, computeMonthTotals, movingAverage, yearTotals, ytdCumulative, capToCurrentMonth, sum,
} from "@/lib/aggregate";

const now = new Date();
const CURRENT_YEAR = now.getFullYear();

export default function DashboardAnnual() {
  const [entriesRaw, setEntriesRaw] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selYear, setSelYear] = useState(CURRENT_YEAR);

  useEffect(() => {
    fetch("/api/entries").then((r) => r.json()).then((data) => { setEntriesRaw(data); setLoading(false); });
  }, []);

  const entries = useMemo(() => capToCurrentMonth(entriesRaw), [entriesRaw]);
  const monthTotals = useMemo(() => computeMonthTotals(entries), [entries]);
  const years = Array.from(new Set(monthTotals.map((t) => t.year))).sort();

  const yearMonths = useMemo(
    () => monthTotals.filter((t) => t.year === selYear).sort((a, b) => a.month - b.month),
    [monthTotals, selYear]
  );

  const yearSummary = useMemo(() => yearTotals(monthTotals, selYear), [monthTotals, selYear]);
  const avgSavingsRate = yearMonths.length ? sum(yearMonths.map((t) => t.savingsRate)) / yearMonths.length : 0;

  // Plus grosse catégorie de dépense de l'année
  const topCategoryOfYear = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of entries) {
      if (e.year !== selYear || (e.group !== "fixes" && e.group !== "variables")) continue;
      totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
    }
    const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
    return sorted[0] ?? null;
  }, [entries, selYear]);

  const savingsRateSeries = useMemo(() => {
    const rates = yearMonths.map((t) => t.savingsRate);
    const ma = movingAverage(rates, 3);
    return yearMonths.map((t, i) => ({
      label: MONTH_LABELS[t.month - 1].slice(0, 3),
      rate: Number(t.savingsRate.toFixed(1)),
      ma3: Number(ma[i].toFixed(1)),
    }));
  }, [yearMonths]);

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
    <div className="space-y-10">
      <div className="flex gap-3 items-center">
        <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Bilan de l'année */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label={`Total épargné en ${selYear}`} value={yearSummary.epargne} />
        <StatTile label="Taux d'épargne moyen" value={avgSavingsRate} isCurrency={false} />
        <StatTile label="Revenus de l'année" value={yearSummary.revenus} />
        <StatTile label="Dépenses de l'année" value={yearSummary.depenses} />
      </div>

      {topCategoryOfYear && (
        <div className="card p-5">
          <p className="text-sm text-gray-700">
            Plus gros poste de dépense de l'année : <strong>{topCategoryOfYear[0]}</strong> avec <Money value={topCategoryOfYear[1]} />
          </p>
        </div>
      )}

      {/* Évolution mensuelle sur l'année */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Évolution mensuelle — {selYear}</h2>
        <div className="grid md:grid-cols-2 gap-6">
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
          <div className="card p-4">
            <p className="text-sm text-gray-500 mb-2">Dépenses fixes vs variables</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={yearMonths.map((t) => ({ label: MONTH_LABELS[t.month - 1].slice(0, 3), Fixes: t.fixes, Variables: t.variables }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} />
                <Legend />
                <Bar dataKey="Fixes" stackId="a" fill={GROUP_COLORS.fixes} />
                <Bar dataKey="Variables" stackId="a" fill={GROUP_COLORS.variables} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Cumul YTD vs année précédente */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Cumul YTD — {selYear} vs {selYear - 1}</h2>
        <div className="card p-4">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={ytdCombined}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} />
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
