import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).optional(),
  amountInvested: z.number().optional(),
  currency: z.string().optional(),
  startDate: z.string().optional(),
  expectedReturnPct: z.number().nullable().optional(),
  notes: z.string().optional(),
  closedAt: z.string().nullable().optional(),
  closedAmount: z.number().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const existing = await prisma.privateInvestment.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Investissement introuvable" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const updated = await prisma.privateInvestment.update({
    where: { id: params.id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.amountInvested !== undefined ? { amountInvested: d.amountInvested } : {}),
      ...(d.currency !== undefined ? { currency: d.currency.toUpperCase() } : {}),
      ...(d.startDate !== undefined ? { startDate: new Date(d.startDate) } : {}),
      ...(d.expectedReturnPct !== undefined ? { expectedReturnPct: d.expectedReturnPct } : {}),
      ...(d.notes !== undefined ? { notes: d.notes } : {}),
      ...(d.closedAt !== undefined ? { closedAt: d.closedAt ? new Date(d.closedAt) : null } : {}),
      ...(d.closedAmount !== undefined ? { closedAmount: d.closedAmount } : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const existing = await prisma.privateInvestment.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Investissement introuvable" }, { status: 404 });
  }

  await prisma.privateInvestment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
