"use client";

import { useCallback, useEffect, useState } from "react";
import PositionsTable from "@/components/investments/PositionsTable";
import AllocationChart from "@/components/investments/AllocationChart";
import InvestedOverTimeChart from "@/components/investments/InvestedOverTimeChart";
import TransactionForm from "@/components/investments/TransactionForm";
import TransactionsList from "@/components/investments/TransactionsList";
import StatTile from "@/components/ui/StatTile";
import { formatAmount } from "@/components/ui/AmountText";
import type { PositionWithQuote } from "@/lib/investments";
import type { InvestmentTxDTO } from "@/types";

export default function InvestmentsPage() {
  const [positions, setPositions] = useState<PositionWithQuote[]>([]);
  const [totals, setTotals] = useState<{
    totalCost: number;
    totalValue: number;
    gainLossAbs: number;
    gainLossPct: number | null;
  } | null>(null);
  const [transactions, setTransactions] = useState<InvestmentTxDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/investments/positions").then((r) => r.json()),
      fetch("/api/investments/transactions").then((r) => r.json()),
    ])
      .then(([positionsData, txData]) => {
        setPositions(positionsData.positions ?? []);
        setTotals(positionsData.totals ?? null);
        setTransactions(txData.transactions ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Investissements</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Valeur actuelle" value={totals ? formatAmount(totals.totalValue) : "—"} />
        <StatTile label="Coût d'acquisition" value={totals ? formatAmount(totals.totalCost) : "—"} />
        <StatTile
          label="Plus/moins-value"
          value={totals ? formatAmount(totals.gainLossAbs) : "—"}
          delta={totals?.gainLossPct ?? null}
        />
        <StatTile label="Nombre de positions" value={positions.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-2 text-sm font-medium">Répartition par titre</h3>
          <AllocationChart positions={positions} />
        </div>
        <div className="card">
          <h3 className="mb-2 text-sm font-medium">Capital investi dans le temps</h3>
          <InvestedOverTimeChart transactions={transactions} />
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 font-semibold">Positions</h3>
        {loading ? <p className="text-sm text-slate-400">Chargement...</p> : <PositionsTable positions={positions} />}
      </div>

      <TransactionForm onSaved={load} />

      <div className="card">
        <h3 className="mb-3 font-semibold">Historique des transactions</h3>
        <TransactionsList transactions={transactions} onDeleted={load} />
      </div>
    </div>
  );
}
