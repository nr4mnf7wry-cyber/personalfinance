import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ code: z.string().min(1) });

// POST /api/household/join -> rejoint le foyer associé à un code d'invitation valide
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Code requis" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.householdId) {
    return NextResponse.json({ error: "Tu fais déjà partie d'un foyer — quitte-le d'abord si tu veux en rejoindre un autre" }, { status: 409 });
  }

  const invite = await prisma.householdInvite.findUnique({ where: { code: parsed.data.code.toUpperCase() } });
  if (!invite || invite.usedAt) {
    return NextResponse.json({ error: "Code invalide ou déjà utilisé" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { householdId: invite.householdId } }),
    prisma.householdInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } }),
  ]);

  return NextResponse.json({ ok: true, householdId: invite.householdId });
}
