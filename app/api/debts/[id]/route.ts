import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeLoanEndDate } from "@/lib/loan";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["car", "house", "personal", "real_estate_investment", "other"]).optional(),
  startDate: z.string().optional(),
  amount: z.number().optional(),
  interestRatePct: z.number().optional(),
  durationMonths: z.number().int().positive().optional(),
  monthlyPayment: z.number().optional(),
  notes: z.string().optional(),
});

// PATCH /api/debts/:id -> modifie la dette et resynchronise la catégorie liée
// (nom + date de fin) si le nom, la date de début ou la durée changent
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const existing = await prisma.debt.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Dette introuvable" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const updated = await prisma.debt.update({
    where: { id: params.id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.type !== undefined ? { type: d.type } : {}),
      ...(d.startDate !== undefined ? { startDate: new Date(d.startDate) } : {}),
      ...(d.amount !== undefined ? { amount: d.amount } : {}),
      ...(d.interestRatePct !== undefined ? { interestRatePct: d.interestRatePct } : {}),
      ...(d.durationMonths !== undefined ? { durationMonths: d.durationMonths } : {}),
      ...(d.monthlyPayment !== undefined ? { monthlyPayment: d.monthlyPayment } : {}),
      ...(d.notes !== undefined ? { notes: d.notes } : {}),
    },
  });

  // Resynchronise la catégorie liée si le nom, la date de début, la durée ou la mensualité ont changé
  if (existing.linkedCategoryId && (d.name !== undefined || d.startDate !== undefined || d.durationMonths !== undefined || d.monthlyPayment !== undefined)) {
    const newEndDate = computeLoanEndDate(
      d.startDate !== undefined ? new Date(d.startDate) : existing.startDate,
      d.durationMonths ?? existing.durationMonths
    );
    await prisma.category.update({
      where: { id: existing.linkedCategoryId },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.monthlyPayment !== undefined ? { defaultAmount: d.monthlyPayment } : {}),
        expiresAt: newEndDate,
      },
    }).catch(() => {}); // si la catégorie a été supprimée manuellement entre-temps, on ignore
  }

  return NextResponse.json(updated);
}

// DELETE /api/debts/:id -> supprime la dette et sa catégorie liée (garde l'historique déjà saisi)
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const existing = await prisma.debt.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Dette introuvable" }, { status: 404 });
  }

  if (existing.linkedCategoryId) {
    await prisma.category.delete({ where: { id: existing.linkedCategoryId } }).catch(() => {});
  }
  await prisma.debt.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
