"use client";

import { useEffect, useMemo, useState } from "react";
import { Money } from "@/components/BlurToggle";
import { computeLoanState } from "@/lib/loan";

const MODULE_LABELS: Record<string, string> = {
  entries: "saisie",
  investments: "investissements cotés",
  private_investments: "investissements non cotés",
  debts: "dettes",
  accounts: "comptes",
  goals: "objectifs",
};

function computeMemberWealth(data: any) {
  let liquid = 0;
  if (data.balances) {
    const valid = data.balances.filter((b: any) => b.endBalance != null);
    const latest = [...valid].sort((a: any, b: any) => (a.year - b.year) || (a.month - b.month)).pop();
    liquid = latest?.endBalance ?? 0;
  }

  let invested = 0;
  if (data.transactions) {
    // coût d'acquisition de ce qui est encore détenu (pas de cours live pour les
    // membres du foyer, pour rester simple — donc une approximation, pas la valeur live)
    const byTicker = new Map<string, { buyQty: number; buyAmount: number; sellQty: number }>();
    for (const t of data.transactions) {
      const cur = byTicker.get(t.ticker) ?? { buyQty: 0, buyAmount: 0, sellQty: 0 };
      if (t.type === "vente") cur.sellQty += t.quantity;
      else { cur.buyQty += t.quantity; cur.buyAmount += t.amount; }
      byTicker.set(t.ticker, cur);
    }
    for (const { buyQty, buyAmount, sellQty } of byTicker.values()) {
      const avgPrice = buyQty > 0 ? buyAmount / buyQty : 0;
      invested += avgPrice * Math.max(buyQty - sellQty, 0);
    }
  }
  if (data.privateInvestments) {
    invested += data.privateInvestments
      .filter((inv: any) => !inv.closedAt)
      .reduce((s: number, inv: any) => {
        const last = [...(inv.valuations ?? [])].sort((a: any, b: any) => a.date.localeCompare(b.date)).pop();
        return s + (last?.estimatedValue ?? inv.amountInvested);
      }, 0);
  }

  let debtRemaining = 0;
  if (data.debts) {
    debtRemaining = data.debts.reduce((s: number, d: any) => {
      const prepaid = (d.prepayments ?? []).reduce((ps: number, p: any) => ps + p.amount, 0);
      const state = computeLoanState(d.amount, d.interestRatePct, d.durationMonths, d.monthlyPayment, new Date(d.startDate), prepaid);
      return s + state.remainingBalance;
    }, 0);
  }

  return { liquid, invested, debtRemaining, wealth: liquid + invested - debtRemaining };
}

export default function HouseholdWealth({ myWealth }: { myWealth: number }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/household/shared-data")
      .then((r) => r.json())
      .then((d) => { setMembers(d.members ?? []); setLoading(false); });
  }, []);

  const memberWealths = useMemo(() => members.map((m) => ({ ...m, wealth: computeMemberWealth(m.data) })), [members]);
  const householdTotal = myWealth + memberWealths.reduce((s, m) => s + m.wealth.wealth, 0);

  if (loading || members.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Patrimoine du foyer</h2>
        <p className="text-sm text-gray-400">
          Uniquement ce que chaque membre a choisi de partager (réglable dans /parametres) — approximatif pour les investissements
          cotés d'un autre membre (coût d'acquisition, pas le cours en direct).
        </p>
      </div>

      <div className="card p-5">
        <p className="text-sm text-gray-500">Patrimoine cumulé du foyer</p>
        <p className="text-2xl font-semibold text-ink"><Money value={householdTotal} /></p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Toi</p>
          <p className="text-xl font-semibold"><Money value={myWealth} /></p>
        </div>
        {memberWealths.map((m) => (
          <div key={m.id} className="card p-5">
            <p className="text-sm text-gray-500">{m.name}</p>
            <p className="text-xl font-semibold"><Money value={m.wealth.wealth} /></p>
            <p className="text-xs text-gray-400 mt-1">
              partage : {m.sharedModules.map((mod: string) => MODULE_LABELS[mod] ?? mod).join(", ")}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
