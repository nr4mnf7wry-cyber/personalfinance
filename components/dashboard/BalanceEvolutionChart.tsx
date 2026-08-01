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
import { formatAmount } from "@/components/ui/AmountText";
import { MONTH_LABELS_SHORT_FR } from "@/lib/categories";
import type { MonthSummaryDTO } from "@/types";

export default function BalanceEvolutionChart({
  series,
  currency,
}: {
  series: MonthSummaryDTO[];
  currency: string;
}) {
  const data = series.map((s) => ({
    label: `${MONTH_LABELS_SHORT_FR[s.month - 1]} ${String(s.year).slice(2)}`,
    balance: s.endingBalance,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
        <Tooltip formatter={(v: number) => formatAmount(v, currency)} />
        <Line
          type="monotone"
          dataKey="balance"
          stroke={SEMANTIC_COLORS.balance}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
