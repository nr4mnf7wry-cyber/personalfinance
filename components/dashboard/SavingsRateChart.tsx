"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SEMANTIC_COLORS } from "@/lib/chartColors";
import { movingAverage } from "@/lib/calculations";
import { MONTH_LABELS_SHORT_FR } from "@/lib/categories";
import type { MonthSummaryDTO } from "@/types";

export default function SavingsRateChart({ series }: { series: MonthSummaryDTO[] }) {
  const rates = series.map((s) => s.savingsRate ?? 0);
  const smoothed = movingAverage(rates, 3);

  const data = series.map((s, i) => ({
    label: `${MONTH_LABELS_SHORT_FR[s.month - 1]} ${String(s.year).slice(2)}`,
    "Taux d'épargne": s.savingsRate !== null ? Number(s.savingsRate.toFixed(1)) : null,
    "Moyenne 3 mois": smoothed[i] !== null ? Number(smoothed[i]!.toFixed(1)) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} unit="%" />
        <Tooltip formatter={(v: number) => `${v}%`} />
        <Line type="monotone" dataKey="Taux d'épargne" stroke={SEMANTIC_COLORS.savings} strokeWidth={1.5} dot={false} strokeOpacity={0.4} />
        <Line type="monotone" dataKey="Moyenne 3 mois" stroke={SEMANTIC_COLORS.savings} strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
