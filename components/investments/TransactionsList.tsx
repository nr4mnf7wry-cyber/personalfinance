"use client";

import AmountText from "@/components/ui/AmountText";
import type { InvestmentTxDTO } from "@/types";

export default function TransactionsList({
  transactions,
  onDeleted,
}: {
  transactions: InvestmentTxDTO[];
  onDeleted: () => void;
}) {
  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette transaction ?")) return;
    await fetch(`/api/investments/transactions?id=${id}`, { method: "DELETE" });
    onDeleted();
  }

  if (transactions.length === 0) {
    return <p className="text-sm text-slate-400">Aucune transaction.</p>;
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-400">
            <th className="pb-2 font-medium">Date</th>
            <th className="pb-2 font-medium">Titre</th>
            <th className="pb-2 font-medium">Type</th>
            <th className="pb-2 text-right font-medium">Quantité</th>
            <th className="pb-2 text-right font-medium">Prix</th>
            <th className="pb-2 text-right font-medium">Total</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-2">{new Date(tx.date).toLocaleDateString("fr-BE")}</td>
              <td className="py-2 font-medium">
                {tx.ticker}
                {tx.linkedEntryId && (
                  <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                    lié à la saisie
                  </span>
                )}
              </td>
              <td className="py-2">
                <span className={tx.type === "BUY" ? "text-income" : "text-expense"}>
                  {tx.type === "BUY" ? "Achat" : "Vente"}
                </span>
              </td>
              <td className="py-2 text-right">{tx.quantity}</td>
              <td className="py-2 text-right">
                <AmountText value={tx.pricePerUnit} currency={tx.currency} />
              </td>
              <td className="py-2 text-right">
                <AmountText value={tx.quantity * tx.pricePerUnit + tx.fees} currency={tx.currency} />
              </td>
              <td className="py-2 text-right">
                <button
                  onClick={() => handleDelete(tx.id)}
                  className="text-xs text-slate-400 hover:text-expense"
                >
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
