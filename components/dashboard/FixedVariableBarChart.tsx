"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SEMANTIC_COLORS } from "@/lib/chartColors";
import { formatAmount } from "@/components/ui/AmountText";
import { MONTH_LABELS_SHORT_FR } from "@/lib/categories";
import type { MonthSummaryDTO } from "@/types";

export default function FixedVariableBarChart({
  series,
  currency,
}: {
  series: MonthSummaryDTO[];
  currency: string;
}) {
  const data = series.map((s) => ({
    label: `${MONTH_LABELS_SHORT_FR[s.month - 1]} ${String(s.year).slice(2)}`,
    Fixes: s.totalFixed,
    Variables: s.totalVariable,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
        <Tooltip formatter={(v: number) => formatAmount(v, currency)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Fixes" stackId="a" fill={SEMANTIC_COLORS.fixed} radius={[0, 0, 0, 0]} />
        <Bar dataKey="Variables" stackId="a" fill={SEMANTIC_COLORS.variable} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
