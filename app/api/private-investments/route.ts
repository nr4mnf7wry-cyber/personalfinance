import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET /api/private-investments -> liste avec leur historique de valorisation
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const investments = await prisma.privateInvestment.findMany({
      where: { userId: (session.user as any).id },
      include: { valuations: { orderBy: { date: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(investments);
  } catch (err) {
    console.error("Erreur DB /api/private-investments GET:", err);
    return NextResponse.json([]);
  }
}

const schema = z.object({
  name: z.string().min(1),
  amountInvested: z.number(),
  currency: z.string().optional(),
  startDate: z.string(),
  expectedReturnPct: z.number().nullable().optional(),
  notes: z.string().optional(),
});

// POST /api/private-investments -> créer un investissement non coté
// (crée automatiquement une première valorisation = montant investi, à date de début)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const investment = await prisma.privateInvestment.create({
    data: {
      userId,
      name: d.name,
      amountInvested: d.amountInvested,
      currency: d.currency?.toUpperCase() || "EUR",
      startDate: new Date(d.startDate),
      expectedReturnPct: d.expectedReturnPct ?? null,
      notes: d.notes,
      valuations: {
        create: [{ date: new Date(d.startDate), estimatedValue: d.amountInvested, note: "Valeur initiale" }],
      },
    },
    include: { valuations: true },
  });

  return NextResponse.json(investment, { status: 201 });
}
