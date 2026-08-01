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

export type YearlyRow = {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
};

export default function YearlyBarChart({
  data,
  currency,
}: {
  data: YearlyRow[];
  currency: string;
}) {
  const chartData = data.map((d) => ({
    year: String(d.year),
    Revenus: d.totalIncome,
    Dépenses: d.totalExpenses,
    Épargne: d.totalSavings,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
        <XAxis dataKey="year" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
        <Tooltip formatter={(v: number) => formatAmount(v, currency)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Revenus" fill={SEMANTIC_COLORS.income} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Dépenses" fill={SEMANTIC_COLORS.expense} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Épargne" fill={SEMANTIC_COLORS.savings} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
