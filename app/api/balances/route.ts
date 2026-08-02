import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET /api/balances?year=2025            -> tous les soldes de l'année
// GET /api/balances?year=2025&month=6    -> le solde de ce mois précis
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  try {
    const balances = await prisma.monthBalance.findMany({
      where: {
        userId,
        ...(year ? { year: Number(year) } : {}),
        ...(month ? { month: Number(month) } : {}),
      },
    });
    return NextResponse.json(balances);
  } catch (err) {
    console.error("Erreur DB /api/balances GET:", err);
    return NextResponse.json([]);
  }
}

const schema = z.object({
  year: z.number(),
  month: z.number().min(1).max(12),
  startBalance: z.number().nullable().optional(),
  endBalance: z.number().nullable().optional(),
});

// POST /api/balances -> upsert du solde début/fin pour un mois
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { year, month, startBalance, endBalance } = parsed.data;

  const balance = await prisma.monthBalance.upsert({
    where: { userId_year_month: { userId, year, month } },
    update: {
      ...(startBalance !== undefined ? { startBalance } : {}),
      ...(endBalance !== undefined ? { endBalance } : {}),
    },
    create: { userId, year, month, startBalance: startBalance ?? null, endBalance: endBalance ?? null },
  });

  return NextResponse.json(balance);
}
