export type WealthPoint = { year: number; month: number; liquid: number; invested: number; total: number };

// Combine le solde de fin de mois (liquidités réelles) avec le capital investi
// cumulé à cette date (achats - ventes, converti en EUR au taux du jour — une
// approximation : on n'a pas le taux de change historique exact de chaque mois).
export function computeWealthEvolution(
  balances: { year: number; month: number; endBalance: number | null }[],
  transactions: { date: string; amount: number; currency: string; type: string }[],
  rates: Record<string, number>
): WealthPoint[] {
  const known = balances
    .filter((b) => b.endBalance != null)
    .sort((a, b) => a.year - b.year || a.month - b.month);

  return known.map((b) => {
    // cutoff = 1er jour du mois suivant -> inclut toutes les transactions du mois b
    const cutoff = new Date(b.year, b.month, 1);
    const invested = transactions
      .filter((t) => new Date(t.date) < cutoff)
      .reduce((s, t) => {
        const signed = t.type === "vente" ? -t.amount : t.amount;
        return s + signed * (rates[t.currency] ?? 1);
      }, 0);
    const liquid = b.endBalance!;
    return { year: b.year, month: b.month, liquid, invested, total: liquid + invested };
  });
}
