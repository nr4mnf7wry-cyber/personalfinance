import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  date: z.string().optional(),
  amount: z.number().positive(),
  note: z.string().optional(),
  closeDebt: z.boolean().optional(), // si true, solde la dette : la catégorie liée s'arrête ce mois-ci
});

// POST /api/debts/:id/prepayments -> enregistre un remboursement anticipé (partiel ou total)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const debt = await prisma.debt.findUnique({ where: { id: params.id } });
  if (!debt || debt.userId !== userId) {
    return NextResponse.json({ error: "Dette introuvable" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const prepayment = await prisma.debtPrepayment.create({
    data: {
      debtId: params.id,
      date: d.date ? new Date(d.date) : new Date(),
      amount: d.amount,
      note: d.note,
    },
  });

  // Solder la dette : la catégorie de dépense fixe liée s'arrête à partir de
  // maintenant (elle n'apparaîtra plus dans les mois futurs de la saisie)
  if (d.closeDebt && debt.linkedCategoryId) {
    const now = new Date();
    await prisma.category.update({
      where: { id: debt.linkedCategoryId },
      data: { expiresAt: new Date(now.getFullYear(), now.getMonth(), 1) },
    }).catch(() => {});
  }

  return NextResponse.json(prepayment, { status: 201 });
}
