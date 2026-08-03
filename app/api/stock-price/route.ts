import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/stock-price?ticker=AAPL  (ou un ETF : SPY, VOO... ou avec suffixe de bourse : IWDA.AS, VWCE.DE)
//
// Stratégie à deux niveaux :
// 1. Finnhub (nécessite FINNHUB_API_KEY) — bonne couverture actions + ETF US, gratuit, 60 req/min.
// 2. Fallback Yahoo Finance (public, sans clé) — meilleure couverture des ETF/actions listés sur
//    les bourses européennes et autres marchés internationaux (utiliser le ticker avec suffixe de
//    bourse, ex: IWDA.AS pour Amsterdam, VWCE.DE pour Xetra, CSPX.L pour Londres).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ error: "Paramètre 'ticker' requis" }, { status: 400 });

  const apiKey = process.env.FINNHUB_API_KEY;

  // 1. Finnhub d'abord (si configuré)
  if (apiKey) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`,
        { next: { revalidate: 60 } }
      );
      const data = await res.json();
      if (data.c !== undefined && data.c !== 0) {
        return NextResponse.json({
          ticker,
          price: data.c,
          previousClose: data.pc,
          change: data.c - data.pc,
          changePercent: data.pc ? ((data.c - data.pc) / data.pc) * 100 : 0,
          source: "finnhub",
        });
      }
    } catch {
      // on tente le fallback ci-dessous
    }
  }

  // 2. Fallback Yahoo Finance (couvre beaucoup plus d'ETF et de bourses internationales)
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`,
      { next: { revalidate: 60 }, headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!res.ok) return NextResponse.json({ error: "Ticker introuvable" }, { status: 404 });
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) {
      return NextResponse.json({ error: "Ticker introuvable" }, { status: 404 });
    }
    const price = meta.regularMarketPrice;
    const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
    return NextResponse.json({
      ticker,
      price,
      previousClose,
      change: price - previousClose,
      changePercent: previousClose ? ((price - previousClose) / previousClose) * 100 : 0,
      source: "yahoo",
    });
  } catch (e) {
    return NextResponse.json({ error: "Erreur lors de l'appel à l'API de cours" }, { status: 502 });
  }
}
