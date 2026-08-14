"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Money } from "@/components/BlurToggle";
import { useWealthSnapshot } from "@/lib/useWealthSnapshot";
import { INK, GOLD, SLATE, POSITIVE, NEGATIVE } from "@/lib/theme";

const TOOLTIP_STYLE = { fontSize: 13, borderRadius: 8, border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(18,35,63,0.08)" };

// Projette le patrimoine mois par mois : chaque mois, le capital existant croît au
// taux de rendement annuel donné (composé), et l'épargne mensuelle s'ajoute en plus.
function projectWealth(start: number, monthlySavings: number, annualReturnPct: number, years: number) {
  const monthlyRate = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
  const points: { month: number; value: number }[] = [{ month: 0, value: start }];
  let value = start;
  for (let m = 1; m <= years * 12; m++) {
    value = value * (1 + monthlyRate) + monthlySavings;
    if (m % 3 === 0 || m === years * 12) points.push({ month: m, value });
  }
  return points;
}

export default function DashboardSimulator() {
  const { loading, totalWealth, avgMonthlySavings } = useWealthSnapshot();

  const [startWealth, setStartWealth] = useState<number | "">("");
  const [monthlySavings, setMonthlySavings] = useState<number | "">("");
  const [years, setYears] = useState(10);
  const [returnRate, setReturnRate] = useState(5);
  const [initialized, setInitialized] = useState(false);

  // Préremplit avec les vraies données une fois chargées, sans écraser une saisie manuelle ensuite
  useEffect(() => {
    if (!loading && !initialized) {
      setStartWealth(Math.round(totalWealth));
      setMonthlySavings(Math.round(avgMonthlySavings));
      setInitialized(true);
    }
  }, [loading, initialized, totalWealth, avgMonthlySavings]);

  const scenarios = useMemo(() => {
    const start = Number(startWealth) || 0;
    const savings = Number(monthlySavings) || 0;
    return {
      prudent: projectWealth(start, savings, Math.max(returnRate - 3, 0), years),
      realiste: projectWealth(start, savings, returnRate, years),
      optimiste: projectWealth(start, savings, returnRate + 3, years),
    };
  }, [startWealth, monthlySavings, returnRate, years]);

  const chartData = scenarios.realiste.map((p, i) => ({
    label: p.month === 0 ? "Aujourd'hui" : `${(p.month / 12).toFixed(p.month % 12 === 0 ? 0 : 1)} ans`,
    Prudent: scenarios.prudent[i]?.value,
    Réaliste: scenarios.realiste[i]?.value,
    Optimiste: scenarios.optimiste[i]?.value,
  }));

  const finalRealiste = scenarios.realiste[scenarios.realiste.length - 1]?.value ?? 0;
  const finalPrudent = scenarios.prudent[scenarios.prudent.length - 1]?.value ?? 0;
  const finalOptimiste = scenarios.optimiste[scenarios.optimiste.length - 1]?.value ?? 0;

  if (loading) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div className="space-y-8">
      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-1">Simulateur de trajectoire patrimoniale</h2>
        <p className="text-sm text-gray-500">
          Projection illustrative — pas une prévision garantie. Trois hypothèses de rendement pour donner une fourchette plutôt qu'un faux sentiment de précision.
        </p>
      </div>

      <div className="card p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Patrimoine de départ</label>
          <input
            type="number" step="100"
            value={startWealth}
            onChange={(e) => setStartWealth(e.target.value === "" ? "" : Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm tabular-nums"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Épargne mensuelle</label>
          <input
            type="number" step="10"
            value={monthlySavings}
            onChange={(e) => setMonthlySavings(e.target.value === "" ? "" : Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm tabular-nums"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Rendement annuel visé (%)</label>
          <input
            type="number" step="0.5"
            value={returnRate}
            onChange={(e) => setReturnRate(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm tabular-nums"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Horizon</label>
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm w-full">
            {[5, 10, 20, 30].map((y) => (
              <button
                key={y}
                onClick={() => setYears(y)}
                className={`flex-1 px-2 py-2 ${years === y ? "bg-accent text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {y} ans
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Scénario prudent ({Math.max(returnRate - 3, 0)}%/an)</p>
          <p className="text-xl font-semibold text-gray-600"><Money value={finalPrudent} /></p>
        </div>
        <div className="card p-5 border-accent/40">
          <p className="text-sm text-gray-500">Scénario réaliste ({returnRate}%/an)</p>
          <p className="text-xl font-semibold text-ink"><Money value={finalRealiste} /></p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Scénario optimiste ({returnRate + 3}%/an)</p>
          <p className="text-xl font-semibold text-gray-600"><Money value={finalOptimiste} /></p>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-sm text-gray-500 mb-2">Trajectoire projetée sur {years} ans</p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.max(Math.floor(chartData.length / 8), 0)} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => `${v.toFixed(0)} €`} contentStyle={TOOLTIP_STYLE} />
            <Legend />
            <Line type="monotone" dataKey="Prudent" stroke={SLATE} strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="Réaliste" stroke={INK} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="Optimiste" stroke={GOLD} strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-gray-400">
        Le patrimoine de départ et l'épargne mensuelle sont préremplis avec tes chiffres réels (<Money value={totalWealth} /> de patrimoine actuel,
        {" "}<Money value={avgMonthlySavings} />/mois d'épargne moyenne sur les 6 derniers mois) — modifie-les librement pour tester d'autres hypothèses.
      </p>
    </div>
  );
}
