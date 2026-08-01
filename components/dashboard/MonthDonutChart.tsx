"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { colorForIndex } from "@/lib/chartColors";
import { formatAmount } from "@/components/ui/AmountText";

export default function MonthDonutChart({
  data,
  currency,
}: {
  data: { categoryName: string; amount: number }[];
  currency: string;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">Aucune dépense ce mois-ci</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="categoryName"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={1}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colorForIndex(i)} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [formatAmount(value, currency), name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
