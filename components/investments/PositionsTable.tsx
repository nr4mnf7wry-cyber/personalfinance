import clsx from "clsx";
import AmountText from "@/components/ui/AmountText";
import type { PositionWithQuote } from "@/lib/investments";

export default function PositionsTable({ positions }: { positions: PositionWithQuote[] }) {
  if (positions.length === 0) {
    return <p className="text-sm text-slate-400">Aucune position actuellement.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-400">
            <th className="pb-2 font-medium">Titre</th>
            <th className="pb-2 text-right font-medium">Quantité</th>
            <th className="pb-2 text-right font-medium">Prix moyen</th>
            <th className="pb-2 text-right font-medium">Coût total</th>
            <th className="pb-2 text-right font-medium">Cours actuel</th>
            <th className="pb-2 text-right font-medium">Valeur</th>
            <th className="pb-2 text-right font-medium">+/- value</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.ticker} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-2">
                <div className="font-medium">{p.ticker}</div>
                {p.name && <div className="text-xs text-slate-400">{p.name}</div>}
              </td>
              <td className="py-2 text-right">{p.quantity.toLocaleString("fr-BE")}</td>
              <td className="py-2 text-right">
                <AmountText value={p.avgCost} currency={p.currency} />
              </td>
              <td className="py-2 text-right">
                <AmountText value={p.totalCost} currency={p.currency} />
              </td>
              <td className="py-2 text-right">
                {p.currentPrice !== null ? (
                  <AmountText value={p.currentPrice} currency={p.currency} />
                ) : (
                  <span className="text-xs text-slate-400">indisponible</span>
                )}
              </td>
              <td className="py-2 text-right">
                {p.marketValue !== null ? (
                  <AmountText value={p.marketValue} currency={p.currency} />
                ) : (
                  "—"
                )}
              </td>
              <td
                className={clsx(
                  "py-2 text-right font-medium",
                  p.gainLossAbs === null
                    ? "text-slate-400"
                    : p.gainLossAbs >= 0
                    ? "text-income"
                    : "text-expense"
                )}
              >
                {p.gainLossAbs !== null ? (
                  <>
                    <AmountText value={p.gainLossAbs} currency={p.currency} />{" "}
                    <span className="text-xs">
                      ({p.gainLossPct! >= 0 ? "+" : ""}
                      {p.gainLossPct!.toFixed(1)}%)
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
