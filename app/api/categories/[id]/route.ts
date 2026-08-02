import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).optional(),
  group: z.enum(["revenus", "fixes", "variables", "epargne"]).optional(),
  expiresAt: z.string().nullable().optional(),
  isInvestment: z.boolean().optional(),
  isAdjustment: z.boolean().optional(),
  order: z.number().optional(),
});

// PATCH /api/categories/:id -> renommer / changer de groupe / date d'expiration / flags
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  // Vérifie que la catégorie appartient bien à l'utilisateur
  const existing = await prisma.category.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Catégorie introuvable" }, { status: 404 });
  }

  try {
    const updated = await prisma.category.update({
      where: { id: params.id },
      data: {
        ...(d.name !== undefined ? { name: d.name.trim() } : {}),
        ...(d.group !== undefined ? { group: d.group } : {}),
        ...(d.expiresAt !== undefined ? { expiresAt: d.expiresAt ? new Date(d.expiresAt) : null } : {}),
        ...(d.isInvestment !== undefined ? { isInvestment: d.isInvestment } : {}),
        ...(d.isAdjustment !== undefined ? { isAdjustment: d.isAdjustment } : {}),
        ...(d.order !== undefined ? { order: d.order } : {}),
      },
    });

    // Si renommée et/ou déplacée vers un autre groupe, on met aussi à jour les
    // lignes déjà saisies pour que l'historique reste cohérent
    const nameChanged = d.name !== undefined && d.name.trim() !== existing.name;
    const groupChanged = d.group !== undefined && d.group !== existing.group;
    if (nameChanged || groupChanged) {
      await prisma.monthEntry.updateMany({
        where: { userId, group: existing.group, category: existing.name },
        data: {
          ...(nameChanged ? { category: d.name!.trim() } : {}),
          ...(groupChanged ? { group: d.group } : {}),
        },
      });
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Une catégorie de ce nom existe déjà dans ce groupe" }, { status: 409 });
    }
    console.error("Erreur DB /api/categories PATCH:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/categories/:id -> supprimer la catégorie (garde l'historique déjà saisi)
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const existing = await prisma.category.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Catégorie introuvable" }, { status: 404 });
  }

  await prisma.category.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
