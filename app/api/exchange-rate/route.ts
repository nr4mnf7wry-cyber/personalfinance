import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/exchange-rate?from=USD&to=EUR
// Utilise Frankfurter (https://frankfurter.dev) : gratuit, sans clé API, taux de
// change quotidiens de la Banque Centrale Européenne. Mis à jour un jour ouvré sur deux.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from")?.toUpperCase();
  const to = searchParams.get("to")?.toUpperCase() ?? "EUR";
  if (!from) return NextResponse.json({ error: "Paramètre 'from' requis" }, { status: 400 });

  if (from === to) {
    return NextResponse.json({ from, to, rate: 1, date: null });
  }

  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`,
      { next: { revalidate: 3600 } } // cache 1h, le taux ne change qu'une fois par jour ouvré
    );
    if (!res.ok) return NextResponse.json({ error: "Devise inconnue" }, { status: 404 });
    const data = await res.json();
    const rate = data.rates?.[to];
    if (!rate) return NextResponse.json({ error: "Devise inconnue" }, { status: 404 });

    return NextResponse.json({ from, to, rate, date: data.date });
  } catch (e) {
    return NextResponse.json({ error: "Erreur lors de l'appel au service de taux de change" }, { status: 502 });
  }
}
