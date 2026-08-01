"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SEMANTIC_COLORS } from "@/lib/chartColors";
import { formatAmount } from "@/components/ui/AmountText";
import type { InvestmentTxDTO } from "@/types";

/** Cumulative net capital invested over time (buys minus sells at cost).
 * Free stock APIs don't provide convenient historical batch pricing, so
 * this tracks invested capital rather than historical market value —
 * still the clearest "portfolio growth" view without paid data. */
export default function InvestedOverTimeChart({
  transactions,
}: {
  transactions: InvestmentTxDTO[];
}) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let cumulative = 0;
  const data = sorted.map((tx) => {
    const amount = tx.quantity * tx.pricePerUnit + tx.fees;
    cumulative += tx.type === "BUY" ? amount : -amount;
    return {
      date: new Date(tx.date).toLocaleDateString("fr-BE", { year: "2-digit", month: "short" }),
      "Capital investi": Math.round(cumulative),
    };
  });

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">Aucune transaction enregistrée</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
        <Tooltip formatter={(v: number) => formatAmount(v)} />
        <Area
          type="stepAfter"
          dataKey="Capital investi"
          stroke={SEMANTIC_COLORS.savings}
          fill={SEMANTIC_COLORS.savings}
          fillOpacity={0.2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
