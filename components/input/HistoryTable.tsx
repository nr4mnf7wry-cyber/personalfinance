"use client";

import { Fragment, useEffect, useState } from "react";
import { GROUP_LABELS, GROUP_ORDER, MONTH_LABELS_SHORT_FR } from "@/lib/categories";
import type { CategoryDTO, EntryDTO } from "@/types";
import AmountText from "@/components/ui/AmountText";

type Cell = { value: number | null };
type MergedCell = { value: number | null; span: number };

function mergeRow(cells: Cell[]): MergedCell[] {
  const merged: MergedCell[] = [];
  for (const cell of cells) {
    const last = merged[merged.length - 1];
    if (last && last.value === cell.value) {
      last.span += 1;
    } else {
      merged.push({ value: cell.value, span: 1 });
    }
  }
  return merged;
}

/** Historical grid view: categories × months, with consecutive equal/empty
 * months merged into a single spanning cell (colSpan) so recurring costs
 * that never change don't clutter the table — the "merger des cellules"
 * feature from the input page. */
export default function HistoryTable({ categories }: { categories: CategoryDTO[] }) {
  const [entries, setEntries] = useState<EntryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const [fromYear] = useState(currentYear - 1);
  const [toYear] = useState(currentYear);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/entries?fromYear=${fromYear}&toYear=${toYear}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .finally(() => setLoading(false));
  }, [fromYear, toYear]);

  const columns: { year: number; month: number }[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === toYear && m > new Date().getMonth() + 1) break;
      columns.push({ year: y, month: m });
    }
  }

  const amountByCatMonth = new Map<string, number>();
  for (const e of entries) {
    amountByCatMonth.set(`${e.categoryId}::${e.year}-${e.month}`, e.amount);
  }

  return (
    <div className="card overflow-x-auto">
      <h3 className="mb-3 font-semibold">Historique ({fromYear}–{toYear})</h3>
      {loading ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : (
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white p-2 text-left dark:bg-slate-900">
                Catégorie
              </th>
              {columns.map((c) => (
                <th key={`${c.year}-${c.month}`} className="p-2 text-right font-medium text-slate-500">
                  {MONTH_LABELS_SHORT_FR[c.month - 1]} {String(c.year).slice(2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUP_ORDER.map((group) => (
              <Fragment key={group}>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <td
                    colSpan={columns.length + 1}
                    className="p-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {GROUP_LABELS[group]}
                  </td>
                </tr>
                {categories
                  .filter((cat) => cat.group === group && !cat.archived)
                  .map((cat) => {
                    const cells = columns.map((c) => ({
                      value: amountByCatMonth.get(`${cat.id}::${c.year}-${c.month}`) ?? null,
                    }));
                    const merged = mergeRow(cells);
                    return (
                      <tr key={cat.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="sticky left-0 bg-white p-2 dark:bg-slate-900">{cat.name}</td>
                        {merged.map((m, i) => (
                          <td
                            key={i}
                            colSpan={m.span}
                            className="p-2 text-right text-slate-600 dark:text-slate-300"
                          >
                            {m.value !== null ? <AmountText value={m.value} /> : "—"}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
