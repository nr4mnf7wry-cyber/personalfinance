import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/household/leave -> quitte le foyer actuel (ne supprime aucune donnée personnelle)
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  await prisma.user.update({ where: { id: userId }, data: { householdId: null } });
  return NextResponse.json({ ok: true });
}
