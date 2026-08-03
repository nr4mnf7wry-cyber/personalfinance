import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  date: z.string().optional(), // par défaut : maintenant
  estimatedValue: z.number(),
  note: z.string().optional(),
});

// POST /api/private-investments/:id/valuations -> ajoute un point de réévaluation
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const investment = await prisma.privateInvestment.findUnique({ where: { id: params.id } });
  if (!investment || investment.userId !== userId) {
    return NextResponse.json({ error: "Investissement introuvable" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const valuation = await prisma.privateInvestmentValuation.create({
    data: {
      investmentId: params.id,
      date: d.date ? new Date(d.date) : new Date(),
      estimatedValue: d.estimatedValue,
      note: d.note,
    },
  });

  return NextResponse.json(valuation, { status: 201 });
}
