import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  date: z.string().optional(),
  ticker: z.string().min(1).optional(),
  label: z.string().optional(),
  type: z.enum(["achat", "vente"]).optional(),
  quantity: z.number().optional(),
  unitPrice: z.number().optional(),
  currency: z.string().optional(),
  sector: z.string().optional(),
});

// PATCH /api/investments/:id -> modifier une transaction (achat ou vente)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const existing = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Transaction introuvable" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const quantity = d.quantity ?? existing.quantity;
  const unitPrice = d.unitPrice ?? existing.unitPrice;

  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data: {
      ...(d.date !== undefined ? { date: new Date(d.date) } : {}),
      ...(d.ticker !== undefined ? { ticker: d.ticker.toUpperCase() } : {}),
      ...(d.label !== undefined ? { label: d.label } : {}),
      ...(d.type !== undefined ? { type: d.type } : {}),
      ...(d.quantity !== undefined ? { quantity: d.quantity } : {}),
      ...(d.unitPrice !== undefined ? { unitPrice: d.unitPrice } : {}),
      ...(d.currency !== undefined ? { currency: d.currency.toUpperCase() } : {}),
      ...(d.sector !== undefined ? { sector: d.sector } : {}),
      amount: quantity * unitPrice,
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/investments/:id -> supprimer une transaction
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const existing = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Transaction introuvable" }, { status: 404 });
  }

  await prisma.transaction.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
