import clsx from "clsx";
import AmountText from "@/components/ui/AmountText";
import { GROUP_LABELS, type CategoryGroupKey } from "@/lib/categories";

export type CategoryChange = {
  categoryId: string;
  categoryName: string;
  group: CategoryGroupKey;
  current: number;
  previous: number;
  pctChange: number | null;
};

export default function YoYPanel({
  changes,
  currency,
}: {
  changes: CategoryChange[];
  currency: string;
}) {
  const nonZero = changes.filter((c) => c.current !== 0 || c.previous !== 0);

  if (nonZero.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Pas encore de données pour la même période l&apos;an dernier.
      </p>
    );
  }

  return (
    <div className="max-h-72 overflow-y-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-400">
            <th className="pb-2 font-medium">Catégorie</th>
            <th className="pb-2 text-right font-medium">Cette année</th>
            <th className="pb-2 text-right font-medium">L&apos;an dernier</th>
            <th className="pb-2 text-right font-medium">Δ</th>
          </tr>
        </thead>
        <tbody>
          {nonZero.map((c) => (
            <tr key={c.categoryId} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-1.5">
                <span className="text-slate-400">{GROUP_LABELS[c.group]} · </span>
                {c.categoryName}
              </td>
              <td className="py-1.5 text-right">
                <AmountText value={c.current} currency={currency} />
              </td>
              <td className="py-1.5 text-right text-slate-500">
                <AmountText value={c.previous} currency={currency} />
              </td>
              <td
                className={clsx(
                  "py-1.5 text-right font-medium",
                  c.pctChange === null
                    ? "text-slate-400"
                    : c.pctChange > 0
                    ? "text-expense"
                    : "text-income"
                )}
              >
                {c.pctChange === null
                  ? "—"
                  : `${c.pctChange > 0 ? "▲" : "▼"} ${Math.abs(c.pctChange).toFixed(0)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
