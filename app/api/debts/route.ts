import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeLoanEndDate } from "@/lib/loan";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const debts = await prisma.debt.findMany({
      where: { userId: (session.user as any).id },
      include: { prepayments: { orderBy: { date: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(debts);
  } catch (err) {
    console.error("Erreur DB /api/debts GET:", err);
    return NextResponse.json([]);
  }
}

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(["car", "house", "personal", "real_estate_investment", "other"]),
  startDate: z.string(),
  amount: z.number(),
  interestRatePct: z.number(),
  durationMonths: z.number().int().positive(),
  monthlyPayment: z.number(),
  notes: z.string().optional(),
});

// POST /api/debts -> crée la dette + une catégorie "fixes" liée (active jusqu'à la
// fin théorique du remboursement), pour que la mensualité apparaisse dans /input
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;
  const startDate = new Date(d.startDate);
  const endDate = computeLoanEndDate(startDate, d.durationMonths);

  try {
    const category = await prisma.category.create({
      data: { userId, group: "fixes", name: d.name, expiresAt: endDate, defaultAmount: d.monthlyPayment },
    });

    const debt = await prisma.debt.create({
      data: {
        userId,
        name: d.name,
        type: d.type,
        startDate,
        amount: d.amount,
        interestRatePct: d.interestRatePct,
        durationMonths: d.durationMonths,
        monthlyPayment: d.monthlyPayment,
        notes: d.notes,
        linkedCategoryId: category.id,
      },
    });

    return NextResponse.json(debt, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Une catégorie de dépense fixe porte déjà ce nom" }, { status: 409 });
    }
    console.error("Erreur DB /api/debts POST:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
