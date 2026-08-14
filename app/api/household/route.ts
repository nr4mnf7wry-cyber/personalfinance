import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/household -> le foyer actuel (membres, invitations en attente), ou null
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      household: {
        include: {
          members: { select: { id: true, name: true, email: true } },
          invites: { where: { usedAt: null }, orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  return NextResponse.json({ household: user?.household ?? null });
}

// POST /api/household -> crée un nouveau foyer et y place l'utilisateur (doit ne pas déjà en avoir un)
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (existing?.householdId) {
    return NextResponse.json({ error: "Tu fais déjà partie d'un foyer" }, { status: 409 });
  }

  const household = await prisma.household.create({ data: {} });
  await prisma.user.update({ where: { id: userId }, data: { householdId: household.id } });

  return NextResponse.json({ household }, { status: 201 });
}
