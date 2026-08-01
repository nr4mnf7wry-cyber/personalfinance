"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SEMANTIC_COLORS } from "@/lib/chartColors";
import { formatAmount } from "@/components/ui/AmountText";
import type { MonthSummaryDTO } from "@/types";

export default function MonthlyBarChart({
  summary,
  currency,
}: {
  summary: MonthSummaryDTO;
  currency: string;
}) {
  const data = [
    { name: "Revenus", value: summary.totalIncome, color: SEMANTIC_COLORS.income },
    { name: "Fixes", value: summary.totalFixed, color: SEMANTIC_COLORS.fixed },
    { name: "Variables", value: summary.totalVariable, color: SEMANTIC_COLORS.variable },
    { name: "Épargne", value: summary.totalSavings, color: SEMANTIC_COLORS.savings },
  ];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip formatter={(v: number) => formatAmount(v, currency)} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
