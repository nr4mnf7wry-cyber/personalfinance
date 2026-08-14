export type WealthPoint = { year: number; month: number; liquid: number; invested: number; total: number };

// Combine le solde de fin de mois (liquidités réelles) avec le capital investi net
// (coût d'acquisition de ce qui est encore détenu à cette date, converti en EUR au
// taux du jour — une approximation : pas de taux de change historique par mois).
export function computeWealthEvolution(
  balances: { year: number; month: number; endBalance: number | null }[],
  transactions: { date: string; amount: number; quantity: number; ticker: string; currency: string; type: string }[],
  rates: Record<string, number>
): WealthPoint[] {
  const known = balances
    .filter((b) => b.endBalance != null)
    .sort((a, b) => a.year - b.year || a.month - b.month);

  return known.map((b) => {
    // cutoff = 1er jour du mois suivant -> inclut toutes les transactions du mois b
    const cutoff = new Date(b.year, b.month, 1);

    // Coût d'acquisition de ce qui est ENCORE détenu à cette date (pas une simple
    // soustraction achats-ventes, qui devient négative après une revente avec plus-value)
    const byTicker = new Map<string, { buyQty: number; buyAmount: number; sellQty: number; currency: string }>();
    for (const t of transactions) {
      if (new Date(t.date) >= cutoff) continue;
      const cur = byTicker.get(t.ticker) ?? { buyQty: 0, buyAmount: 0, sellQty: 0, currency: t.currency ?? "EUR" };
      if (t.type === "vente") cur.sellQty += t.quantity;
      else { cur.buyQty += t.quantity; cur.buyAmount += t.amount; }
      byTicker.set(t.ticker, cur);
    }
    let invested = 0;
    for (const { buyQty, buyAmount, sellQty, currency } of byTicker.values()) {
      const avgPrice = buyQty > 0 ? buyAmount / buyQty : 0;
      const remainingQty = Math.max(buyQty - sellQty, 0);
      invested += avgPrice * remainingQty * (rates[currency] ?? 1);
    }

    const liquid = b.endBalance!;
    return { year: b.year, month: b.month, liquid, invested, total: liquid + invested };
  });
}
