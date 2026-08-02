import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET /api/entries?year=2025            -> toutes les lignes de l'année
// GET /api/entries?year=2025&month=6    -> toutes les lignes du mois
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  try {
    const entries = await prisma.monthEntry.findMany({
      where: {
        userId: (session.user as any).id,
        ...(year ? { year: Number(year) } : {}),
        ...(month ? { month: Number(month) } : {}),
      },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });
    return NextResponse.json(entries);
  } catch (err) {
    console.error("Erreur DB /api/entries GET:", err);
    return NextResponse.json([]);
  }
}

// DELETE /api/entries                              -> supprime TOUT l'historique de l'utilisateur
// DELETE /api/entries?group=fixes&category=Loyer    -> supprime uniquement cette ligne (tous les mois)
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const { searchParams } = new URL(req.url);
  const group = searchParams.get("group");
  const category = searchParams.get("category");

  const result = await prisma.monthEntry.deleteMany({
    where: {
      userId,
      ...(group ? { group } : {}),
      ...(category ? { category } : {}),
    },
  });

  return NextResponse.json({ deleted: result.count });
}

const lineSchema = z.object({
  group: z.enum(["revenus", "fixes", "variables", "epargne"]),
  category: z.string().min(1),
  subCategory: z.string().nullable().optional(),
  amount: z.number(),
  // si présent, alimente/complète une transaction d'investissement
  investment: z
    .object({
      ticker: z.string().min(1),
      label: z.string().optional(),
      quantity: z.number(),
      unitPrice: z.number(),
      currency: z.string().optional(),
      sector: z.string().optional(),
    })
    .optional(),
});

const bodySchema = z.object({
  year: z.number(),
  month: z.number().min(1).max(12),
  lines: z.array(lineSchema),
});

// POST /api/entries  -> upsert de toutes les lignes d'un mois en une fois
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { year, month, lines } = parsed.data;

  // Récupère les flags des catégories de l'utilisateur (isInvestment, isAdjustment)
  const categories = await prisma.category.findMany({ where: { userId } });
  const categoryFlags = new Map(categories.map((c) => [`${c.group}:${c.name}`, c]));

  const results = [];
  for (const line of lines) {
    let transactionId: string | undefined;
    const catInfo = categoryFlags.get(`${line.group}:${line.category}`);

    // Catégorie marquée "Investissement" -> crée/complète une transaction liée
    if (catInfo?.isInvestment && line.investment) {
      const tx = await prisma.transaction.create({
        data: {
          userId,
          date: new Date(year, month - 1, 1),
          ticker: line.investment.ticker.toUpperCase(),
          label: line.investment.label,
          quantity: line.investment.quantity,
          unitPrice: line.investment.unitPrice,
          currency: line.investment.currency ?? "EUR",
          amount: line.amount,
          sector: line.investment.sector,
        },
      });
      transactionId = tx.id;
    }

    const entry = await prisma.monthEntry.upsert({
      where: {
        userId_year_month_category_subCategory: {
          userId,
          year,
          month,
          category: line.category,
          subCategory: line.subCategory ?? "",
        },
      },
      update: { amount: line.amount, ...(transactionId ? { transactionId } : {}) },
      create: {
        userId,
        year,
        month,
        group: line.group,
        category: line.category,
        subCategory: line.subCategory ?? "",
        amount: line.amount,
        ...(transactionId ? { transactionId } : {}),
      },
    });
    results.push(entry);
  }

  return NextResponse.json({ count: results.length, entries: results });
}
