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
        _count: {
          select: {
            entries: true,
            transactions: true,
            debts: true,
            bankAccounts: true,
            goals: true,
            privateInvestments: true,
          },
        },
        entries: { select: { updatedAt: true, year: true, month: true }, orderBy: { updatedAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const userList = users.map((u) => {
    const lastActivity = u.entries[0]?.updatedAt ?? null;
    // Nombre de mois DISTINCTS saisis (pas le nombre de lignes) — mesure la vraie
    // profondeur d'usage dans le temps, sans jamais lire un montant
    const distinctMonths = new Set(u.entries.map((e) => `${e.year}-${e.month}`)).size;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      entryCount: u._count.entries,
      transactionCount: u._count.transactions,
      monthsTracked: distinctMonths,
      usesInvestments: u._count.transactions > 0 || u._count.privateInvestments > 0,
      usesDebts: u._count.debts > 0,
      usesAccounts: u._count.bankAccounts > 0,
      usesGoals: u._count.goals > 0,
      lastActivity,
      activeLast7Days: lastActivity ? new Date(lastActivity) >= sevenDaysAgo : false,
      activeLast30Days: lastActivity ? new Date(lastActivity) >= thirtyDaysAgo : false,
    };
  });

  const usersWithData = userList.filter((u) => u.entryCount > 0);
  const inactiveUsers = userList.filter((u) => u.entryCount === 0);
  const avgMonthsPerActiveUser = usersWithData.length > 0
    ? usersWithData.reduce((s, u) => s + u.monthsTracked, 0) / usersWithData.length
    : 0;

  const adoption = {
    investments: usersWithData.length ? Math.round((userList.filter((u) => u.usesInvestments).length / usersWithData.length) * 100) : 0,
    debts: usersWithData.length ? Math.round((userList.filter((u) => u.usesDebts).length / usersWithData.length) * 100) : 0,
    accounts: usersWithData.length ? Math.round((userList.filter((u) => u.usesAccounts).length / usersWithData.length) * 100) : 0,
    goals: usersWithData.length ? Math.round((userList.filter((u) => u.usesGoals).length / usersWithData.length) * 100) : 0,
  };

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
    activeUsersLast7Days: userList.filter((u) => u.activeLast7Days).length,
    activeUsersLast30Days: userList.filter((u) => u.activeLast30Days).length,
    usersWithNoData: inactiveUsers.length,
    avgMonthsPerActiveUser: Math.round(avgMonthsPerActiveUser * 10) / 10,
    adoption,
    signupsByMonth,
    users: userList,
  });
}
