import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// POST /api/household/invite -> génère un code d'invitation à usage unique
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.householdId) {
    return NextResponse.json({ error: "Crée d'abord un foyer" }, { status: 400 });
  }

  const code = crypto.randomBytes(4).toString("hex").toUpperCase(); // ex: "A1B2C3D4"

  const invite = await prisma.householdInvite.create({
    data: { householdId: user.householdId, code, createdByUserId: userId },
  });

  return NextResponse.json(invite, { status: 201 });
}
