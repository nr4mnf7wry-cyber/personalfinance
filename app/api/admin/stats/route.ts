import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

// GET /api/admin/stats -> statistiques d'usage agrégées et anonymisées (pas les
// montants financiers des utilisateurs — juste des indicateurs d'activité)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Accès réservé" }, { status: 403 });
  }

  const [totalUsers, totalEntries, totalTransactions, totalHouseholds, users] = await Promise.all([
    prisma.user.count(),
    prisma.monthEntry.count(),
    prisma.transaction.count(),
    prisma.household.count(),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        _count: { select: { entries: true, transactions: true } },
        entries: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const userList = users.map((u) => {
    const lastActivity = u.entries[0]?.updatedAt ?? null;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      entryCount: u._count.entries,
      transactionCount: u._count.transactions,
      lastActivity,
      activeLast30Days: lastActivity ? new Date(lastActivity) >= thirtyDaysAgo : false,
    };
  });

  // Inscriptions par mois (12 derniers mois)
  const now = new Date();
  const signupsByMonth: { label: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const count = userList.filter((u) => new Date(u.createdAt) >= d && new Date(u.createdAt) < nextD).length;
    signupsByMonth.push({ label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }), count });
  }

  return NextResponse.json({
    totalUsers,
    totalEntries,
    totalTransactions,
    totalHouseholds,
    activeUsersLast30Days: userList.filter((u) => u.activeLast30Days).length,
    signupsByMonth,
    users: userList,
  });
}
