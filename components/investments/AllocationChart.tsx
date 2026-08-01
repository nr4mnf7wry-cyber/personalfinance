"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { colorForIndex } from "@/lib/chartColors";
import { formatAmount } from "@/components/ui/AmountText";
import type { PositionWithQuote } from "@/lib/investments";

export default function AllocationChart({ positions }: { positions: PositionWithQuote[] }) {
  const data = positions.map((p) => ({
    name: p.ticker,
    value: p.marketValue ?? p.totalCost,
  }));

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">Aucune position</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={1}>
          {data.map((_, i) => (
            <Cell key={i} fill={colorForIndex(i)} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number, name: string) => [formatAmount(v), name]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
