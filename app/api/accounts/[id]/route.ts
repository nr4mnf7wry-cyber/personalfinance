import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ACCOUNT_TYPES = ["fixes", "variables", "epargne_investissement", "loisirs_autres", "autre"] as const;

const schema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(ACCOUNT_TYPES).optional(),
  balance: z.number().optional(),
  allocationPct: z.number().nullable().optional(),
  monthlyBudget: z.number().nullable().optional(),
  order: z.number().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const existing = await prisma.bankAccount.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const updated = await prisma.bankAccount.update({
    where: { id: params.id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.type !== undefined ? { type: d.type } : {}),
      ...(d.balance !== undefined ? { balance: d.balance } : {}),
      ...(d.allocationPct !== undefined ? { allocationPct: d.allocationPct } : {}),
      ...(d.monthlyBudget !== undefined ? { monthlyBudget: d.monthlyBudget } : {}),
      ...(d.order !== undefined ? { order: d.order } : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const existing = await prisma.bankAccount.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  }

  await prisma.bankAccount.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
