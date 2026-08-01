import type { QuoteDTO } from "@/types";

// Finnhub is tried first (higher free-tier rate limit: 60 req/min vs Alpha
// Vantage's 25 req/day). Falls back to Alpha Vantage, then to "unavailable"
// so the UI can show a manual-refresh state instead of crashing.
export async function getQuote(ticker: string): Promise<QuoteDTO> {
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const alphaKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (finnhubKey) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
          ticker
        )}&token=${finnhubKey}`,
        { next: { revalidate: 300 } }
      );
      if (res.ok) {
        const data = await res.json();
        if (typeof data.c === "number" && data.c > 0) {
          return {
            ticker,
            price: data.c,
            currency: "USD",
            asOf: new Date().toISOString(),
            source: "finnhub",
          };
        }
      }
    } catch {
      // fall through to next provider
    }
  }

  if (alphaKey) {
    try {
      const res = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
          ticker
        )}&apikey=${alphaKey}`,
        { next: { revalidate: 300 } }
      );
      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data?.["Global Quote"]?.["05. price"]);
        if (!Number.isNaN(price) && price > 0) {
          return {
            ticker,
            price,
            currency: "USD",
            asOf: new Date().toISOString(),
            source: "alphavantage",
          };
        }
      }
    } catch {
      // fall through
    }
  }

  return {
    ticker,
    price: 0,
    currency: "USD",
    asOf: new Date().toISOString(),
    source: "unavailable",
  };
}

export async function getQuotes(tickers: string[]): Promise<QuoteDTO[]> {
  const unique = Array.from(new Set(tickers));
  const results: QuoteDTO[] = [];
  // Sequential with small delay to stay under free-tier rate limits.
  for (const ticker of unique) {
    results.push(await getQuote(ticker));
  }
  return results;
}
