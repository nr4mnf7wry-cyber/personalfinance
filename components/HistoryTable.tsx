"use client";

import { useMemo } from "react";
import { ALL_CATEGORIES, MONTH_LABELS } from "@/lib/categories";
import { Money } from "@/components/BlurToggle";

type Entry = { year: number; month: number; category: string; amount: number };

export default function HistoryTable({ entries }: { entries: Entry[] }) {
  // Construit la liste triée des mois présents
  const months = useMemo(() => {
    const set = new Set(entries.map((e) => `${e.year}-${e.month}`));
    return Array.from(set)
      .map((s) => {
        const [y, m] = s.split("-").map(Number);
        return { year: y, month: m };
      })
      .sort((a, b) => a.year - b.year || a.month - b.month);
  }, [entries]);

  // grid[category][monthIndex] = amount
  const grid = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const c of ALL_CATEGORIES) map[c.category] = {};
    for (const e of entries) {
      const key = `${e.year}-${e.month}`;
      if (!map[e.category]) map[e.category] = {};
      map[e.category][key] = e.amount;
    }
    return map;
  }, [entries]);

  if (months.length === 0) {
    return <p className="text-sm text-gray-500">Aucune saisie pour le moment.</p>;
  }

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left px-4 py-2 sticky left-0 bg-white">Catégorie</th>
            {months.map((m) => (
              <th key={`${m.year}-${m.month}`} className="text-right px-4 py-2 whitespace-nowrap">
                {MONTH_LABELS[m.month - 1].slice(0, 3)} {m.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_CATEGORIES.map(({ category }) => {
            const row = grid[category] ?? {};
            // calcule les "runs" de valeurs identiques consécutives pour fusion visuelle
            const cells = months.map((m) => row[`${m.year}-${m.month}`] ?? null);
            const spans: { value: number | null; span: number }[] = [];
            for (let i = 0; i < cells.length; i++) {
              if (i > 0 && cells[i] === cells[i - 1]) {
                spans[spans.length - 1].span++;
              } else {
                spans.push({ value: cells[i], span: 1 });
              }
            }
            return (
              <tr key={category} className="border-b border-gray-100">
                <td className="px-4 py-2 sticky left-0 bg-white text-gray-700">{category}</td>
                {spans.map((s, idx) => (
                  <td
                    key={idx}
                    colSpan={s.span}
                    className="text-right px-4 py-2 text-gray-800"
                  >
                    {s.value !== null ? <Money value={s.value} /> : <span className="text-gray-300">—</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
