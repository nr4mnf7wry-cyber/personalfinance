import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/household/shared-data
// Renvoie, pour chaque AUTRE membre du foyer, uniquement les modules qu'il/elle a
// explicitement rendus visibles (rien par défaut). Les données restent attribuées
// nommément à leur propriétaire — jamais fusionnées silencieusement avec les tiennes.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me?.householdId) {
    return NextResponse.json({ members: [] });
  }

  const otherMembers = await prisma.user.findMany({
    where: { householdId: me.householdId, id: { not: userId } },
    select: { id: true, name: true, email: true },
  });

  const result = [];
  for (const member of otherMembers) {
    const settings = await prisma.sharingSetting.findMany({ where: { userId: member.id } });
    const visible = new Set(settings.filter((s) => s.visible).map((s) => s.module));
    if (visible.size === 0) continue; // ce membre ne partage rien : on ne renvoie même pas son nom

    const data: Record<string, any> = {};

    if (visible.has("entries")) {
      data.entries = await prisma.monthEntry.findMany({ where: { userId: member.id } });
      data.balances = await prisma.monthBalance.findMany({ where: { userId: member.id } });
    }
    if (visible.has("investments")) {
      data.transactions = await prisma.transaction.findMany({ where: { userId: member.id } });
    }
    if (visible.has("private_investments")) {
      data.privateInvestments = await prisma.privateInvestment.findMany({
        where: { userId: member.id },
        include: { valuations: true },
      });
    }
    if (visible.has("debts")) {
      data.debts = await prisma.debt.findMany({ where: { userId: member.id }, include: { prepayments: true } });
    }
    if (visible.has("accounts")) {
      data.accounts = await prisma.bankAccount.findMany({ where: { userId: member.id } });
    }
    if (visible.has("goals")) {
      data.goals = await prisma.goal.findMany({ where: { userId: member.id } });
    }

    result.push({
      id: member.id,
      name: member.name || member.email,
      sharedModules: Array.from(visible),
      data,
    });
  }

  return NextResponse.json({ members: result });
}
