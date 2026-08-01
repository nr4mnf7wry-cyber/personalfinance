"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AmountText from "@/components/ui/AmountText";
import clsx from "clsx";

export default function InvestmentsWidget() {
  const [totals, setTotals] = useState<{
    totalCost: number;
    totalValue: number;
    gainLossAbs: number;
    gainLossPct: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/investments/positions")
      .then((r) => r.json())
      .then((d) => setTotals(d.totals))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Portefeuille d&apos;investissements</h3>
        <Link href="/investments" className="text-sm text-brand-600 underline">
          Voir le détail →
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : !totals || totals.totalCost === 0 ? (
        <p className="text-sm text-slate-400">Aucune position enregistrée pour l&apos;instant.</p>
      ) : (
        <div className="flex flex-wrap gap-6">
          <div>
            <span className="text-xs text-slate-500">Valeur actuelle</span>
            <p className="blur-target text-xl font-semibold">
              <AmountText value={totals.totalValue} />
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Coût d&apos;acquisition</span>
            <p className="blur-target text-xl font-semibold text-slate-500">
              <AmountText value={totals.totalCost} />
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Plus/moins-value</span>
            <p
              className={clsx(
                "blur-target text-xl font-semibold",
                totals.gainLossAbs >= 0 ? "text-income" : "text-expense"
              )}
            >
              <AmountText value={totals.gainLossAbs} />
              {totals.gainLossPct !== null && (
                <span className="ml-1 text-sm">
                  ({totals.gainLossPct >= 0 ? "+" : ""}
                  {totals.gainLossPct.toFixed(1)}%)
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
