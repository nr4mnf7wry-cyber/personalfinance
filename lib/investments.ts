import type { InvestmentTxDTO, QuoteDTO } from "@/types";

export type Position = {
  ticker: string;
  name: string | null;
  quantity: number;
  avgCost: number;
  totalCost: number;
  currency: string;
};

/** Aggregates raw BUY/SELL transactions into current holdings (simple weighted-average cost basis). */
export function computePositions(transactions: InvestmentTxDTO[]): Position[] {
  const byTicker = new Map<
    string,
    { quantity: number; totalCost: number; name: string | null; currency: string }
  >();

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const tx of sorted) {
    const existing = byTicker.get(tx.ticker) ?? {
      quantity: 0,
      totalCost: 0,
      name: tx.name ?? null,
      currency: tx.currency,
    };

    if (tx.type === "BUY") {
      existing.quantity += tx.quantity;
      existing.totalCost += tx.quantity * tx.pricePerUnit + tx.fees;
    } else {
      // SELL: reduce quantity and cost basis proportionally (weighted-average method).
      const avgCost = existing.quantity > 0 ? existing.totalCost / existing.quantity : 0;
      existing.quantity -= tx.quantity;
      existing.totalCost -= tx.quantity * avgCost;
      if (existing.quantity < 0.0001) {
        existing.quantity = 0;
        existing.totalCost = 0;
      }
    }
    existing.name = tx.name ?? existing.name;
    byTicker.set(tx.ticker, existing);
  }

  return Array.from(byTicker.entries())
    .filter(([, v]) => v.quantity > 0.0001)
    .map(([ticker, v]) => ({
      ticker,
      name: v.name,
      quantity: v.quantity,
      totalCost: v.totalCost,
      avgCost: v.totalCost / v.quantity,
      currency: v.currency,
    }));
}

export type PositionWithQuote = Position & {
  currentPrice: number | null;
  marketValue: number | null;
  gainLossAbs: number | null;
  gainLossPct: number | null;
  quoteSource: QuoteDTO["source"];
};

export function mergeQuotes(
  positions: Position[],
  quotes: QuoteDTO[]
): PositionWithQuote[] {
  const quoteByTicker = new Map(quotes.map((q) => [q.ticker, q]));
  return positions.map((p) => {
    const q = quoteByTicker.get(p.ticker);
    const currentPrice = q && q.source !== "unavailable" ? q.price : null;
    const marketValue = currentPrice !== null ? currentPrice * p.quantity : null;
    const gainLossAbs = marketValue !== null ? marketValue - p.totalCost : null;
    const gainLossPct =
      marketValue !== null && p.totalCost > 0
        ? (gainLossAbs! / p.totalCost) * 100
        : null;
    return {
      ...p,
      currentPrice,
      marketValue,
      gainLossAbs,
      gainLossPct,
      quoteSource: q?.source ?? "unavailable",
    };
  });
}
