import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: (session.user as any).id },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(transactions);
  } catch (err) {
    console.error("Erreur DB /api/investments GET:", err);
    return NextResponse.json([]);
  }
}

const schema = z.object({
  date: z.string(), // ISO
  ticker: z.string().min(1),
  label: z.string().optional(),
  quantity: z.number(),
  unitPrice: z.number(),
  sector: z.string().optional(),
});

// Ajout manuel d'une transaction (complément à celles générées depuis /input)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const tx = await prisma.transaction.create({
    data: {
      userId: (session.user as any).id,
      date: new Date(d.date),
      ticker: d.ticker.toUpperCase(),
      label: d.label,
      quantity: d.quantity,
      unitPrice: d.unitPrice,
      amount: d.quantity * d.unitPrice,
      sector: d.sector,
    },
  });

  return NextResponse.json(tx, { status: 201 });
}
