import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/stock-price?ticker=AAPL                    -> cours en direct
// GET /api/stock-price?ticker=AAPL&date=2026-07-31     -> cours de clôture au (ou juste avant) cette date
//
// Le cours en direct utilise Finnhub puis Yahoo Finance en repli. Le cours historique
// utilise uniquement Yahoo Finance (Finnhub ne le propose pas gratuitement) : on
// récupère les clôtures quotidiennes sur une fenêtre autour de la date demandée, et on
// prend la dernière clôture connue à cette date ou avant (gère les week-ends/jours fériés).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");
  const dateParam = searchParams.get("date"); // YYYY-MM-DD
  if (!ticker) return NextResponse.json({ error: "Paramètre 'ticker' requis" }, { status: 400 });

  if (dateParam) return getHistoricalPrice(ticker, dateParam);
  return getLivePrice(ticker);
}

async function getLivePrice(ticker: string) {
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
    if (!res.ok) return NextResponse.json({ error: "Ticker introuvable — vérifie le suffixe de bourse (ex: .PA Paris, .BR Bruxelles, .AS Amsterdam, .DE Xetra, .L Londres)" }, { status: 404 });
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) {
      return NextResponse.json({ error: "Ticker introuvable — vérifie le suffixe de bourse (ex: .PA Paris, .BR Bruxelles, .AS Amsterdam, .DE Xetra, .L Londres)" }, { status: 404 });
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

async function getHistoricalPrice(ticker: string, dateParam: string) {
  const targetDate = new Date(dateParam + "T12:00:00Z"); // midi UTC pour éviter les soucis de fuseau
  if (Number.isNaN(targetDate.getTime())) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }
  // fenêtre de 12 jours avant la date cible, large pour couvrir week-ends + jours fériés
  const period2 = Math.floor(targetDate.getTime() / 1000) + 24 * 3600;
  const period1 = period2 - 12 * 24 * 3600;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d`,
      { next: { revalidate: 3600 }, headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!res.ok) return NextResponse.json({ error: "Ticker introuvable" }, { status: 404 });
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp ?? [];
    const closes: number[] = result?.indicators?.quote?.[0]?.close ?? [];

    if (timestamps.length === 0) {
      return NextResponse.json({ error: "Pas de données historiques pour ce ticker à cette date" }, { status: 404 });
    }

    // dernière clôture connue à la date cible ou avant
    let bestIdx = -1;
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] * 1000 <= targetDate.getTime() && closes[i] != null) bestIdx = i;
    }
    if (bestIdx === -1) {
      return NextResponse.json({ error: "Pas de clôture disponible avant cette date" }, { status: 404 });
    }

    return NextResponse.json({
      ticker,
      price: closes[bestIdx],
      date: new Date(timestamps[bestIdx] * 1000).toISOString().slice(0, 10),
      source: "yahoo-historical",
    });
  } catch (e) {
    return NextResponse.json({ error: "Erreur lors de l'appel à l'API de cours historique" }, { status: 502 });
  }
}
