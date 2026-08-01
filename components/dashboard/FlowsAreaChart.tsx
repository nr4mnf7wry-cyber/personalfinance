"use client";

import {
  Area,
  AreaChart,
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

export default function FlowsAreaChart({
  series,
  currency,
}: {
  series: MonthSummaryDTO[];
  currency: string;
}) {
  const data = series.map((s) => ({
    label: `${MONTH_LABELS_SHORT_FR[s.month - 1]} ${String(s.year).slice(2)}`,
    Revenus: s.totalIncome,
    Dépenses: s.totalExpenses,
    Épargne: s.totalSavings,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
        <Tooltip formatter={(v: number) => formatAmount(v, currency)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="Revenus" stackId="1" stroke={SEMANTIC_COLORS.income} fill={SEMANTIC_COLORS.income} fillOpacity={0.25} />
        <Area type="monotone" dataKey="Dépenses" stackId="2" stroke={SEMANTIC_COLORS.expense} fill={SEMANTIC_COLORS.expense} fillOpacity={0.25} />
        <Area type="monotone" dataKey="Épargne" stackId="2" stroke={SEMANTIC_COLORS.savings} fill={SEMANTIC_COLORS.savings} fillOpacity={0.25} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
