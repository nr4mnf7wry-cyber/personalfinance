import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/stock-price?ticker=AAPL
// Utilise Finnhub (gratuit, simple : 1 requête = 1 cours en temps quasi réel).
// Pour basculer sur Alpha Vantage, voir le commentaire en bas de fichier.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ error: "Paramètre 'ticker' requis" }, { status: 400 });

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "FINNHUB_API_KEY non configurée (voir .env.example)" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`,
      { next: { revalidate: 60 } } // cache 60s pour ménager le quota gratuit
    );
    const data = await res.json();

    // data.c = cours actuel, data.pc = clôture précédente
    if (data.c === undefined) {
      return NextResponse.json({ error: "Ticker introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      ticker,
      price: data.c,
      previousClose: data.pc,
      change: data.c - data.pc,
      changePercent: data.pc ? ((data.c - data.pc) / data.pc) * 100 : 0,
    });
  } catch (e) {
    return NextResponse.json({ error: "Erreur lors de l'appel à l'API de cours" }, { status: 502 });
  }
}

/*
 Alternative Alpha Vantage :
 const res = await fetch(
   `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${process.env.ALPHAVANTAGE_API_KEY}`
 );
 const data = await res.json();
 const quote = data["Global Quote"];
 price = parseFloat(quote["05. price"]);
 -> Alpha Vantage limite à 25 requêtes/jour en gratuit, Finnhub est plus généreux (60/min),
    d'où le choix de Finnhub par défaut.
*/
