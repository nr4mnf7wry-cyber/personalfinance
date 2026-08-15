import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { computeMonthTotals } from "@/lib/aggregate";
import { computeLoanState } from "@/lib/loan";

// Nombre minimum d'utilisateurs actifs avant d'afficher quoi que ce soit d'agrégé sur
// les finances — en dessous, une moyenne ou un histogramme redevient trop proche d'un
// chiffre individuel identifiable.
const MIN_USERS_FOR_FINANCIAL_STATS = 5;

// Répartit une valeur dans des tranches (histogramme) plutôt que d'exposer une médiane
// ou un percentile — une médiane sur un petit groupe EST littéralement le chiffre réel
// d'une personne précise, un histogramme ne révèle jamais un chiffre individuel.
function bucketize(values: number[], edges: number[], labels: string[]) {
  const counts = new Array(labels.length).fill(0);
  for (const v of values) {
    let idx = edges.findIndex((e) => v < e);
    if (idx === -1) idx = labels.length - 1;
    counts[idx]++;
  }
  return labels.map((label, i) => ({ label, count: counts[i] }));
}

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

  // Statistiques financières agrégées — UNIQUEMENT des histogrammes (jamais une valeur
  // individuelle, jamais une médiane), et seulement si assez d'utilisateurs actifs pour
  // qu'aucune tranche ne redevienne identifiable à une personne précise.
  let financialStats: any = null;
  if (usersWithData.length >= MIN_USERS_FOR_FINANCIAL_STATS) {
    const userIds = usersWithData.map((u) => u.id);
    const [allEntries, allBalances, allTransactions, allPrivateInvestments, allDebts] = await Promise.all([
      prisma.monthEntry.findMany({ where: { userId: { in: userIds } }, select: { userId: true, year: true, month: true, group: true, category: true, amount: true } }),
      prisma.monthBalance.findMany({ where: { userId: { in: userIds } }, select: { userId: true, year: true, month: true, startBalance: true, endBalance: true } }),
      prisma.transaction.findMany({ where: { userId: { in: userIds } }, select: { userId: true, ticker: true, type: true, quantity: true, amount: true, currency: true } }),
      prisma.privateInvestment.findMany({ where: { userId: { in: userIds } }, select: { userId: true, amountInvested: true, currency: true, closedAt: true, valuations: { select: { estimatedValue: true, date: true } } } }),
      prisma.debt.findMany({ where: { userId: { in: userIds } }, select: { userId: true, amount: true, interestRatePct: true, durationMonths: true, monthlyPayment: true, startDate: true, prepayments: { select: { amount: true } } } }),
    ]);

    const savingsRates: number[] = [];
    const netWorths: number[] = [];

    for (const uid of userIds) {
      const userEntries = allEntries.filter((e) => e.userId === uid) as any;
      const userBalances = allBalances.filter((b) => b.userId === uid) as any;
      const monthTotals = computeMonthTotals(userEntries, userBalances);
      if (monthTotals.length > 0) {
        const recent = monthTotals.slice(-6);
        const avgRate = recent.reduce((s: number, t: any) => s + t.savingsRate, 0) / recent.length;
        if (Number.isFinite(avgRate)) savingsRates.push(avgRate);
      }

      // Patrimoine net approximatif — coût d'acquisition (pas de cours live, pour rester
      // rapide ici) et taux de change ignoré (traité comme EUR, approximation assumée)
      const validBalances = userBalances.filter((b: any) => b.endBalance != null).sort((a: any, b: any) => a.year - b.year || a.month - b.month);
      const liquid = validBalances.length ? validBalances[validBalances.length - 1].endBalance : 0;

      const byTicker = new Map<string, { buyQty: number; buyAmount: number; sellQty: number }>();
      for (const t of allTransactions.filter((t) => t.userId === uid)) {
        const cur = byTicker.get(t.ticker) ?? { buyQty: 0, buyAmount: 0, sellQty: 0 };
        if (t.type === "vente") cur.sellQty += t.quantity; else { cur.buyQty += t.quantity; cur.buyAmount += t.amount; }
        byTicker.set(t.ticker, cur);
      }
      let listedValue = 0;
      for (const { buyQty, buyAmount, sellQty } of byTicker.values()) {
        const avgPrice = buyQty > 0 ? buyAmount / buyQty : 0;
        listedValue += avgPrice * Math.max(buyQty - sellQty, 0);
      }

      const privateValue = allPrivateInvestments.filter((p) => p.userId === uid && !p.closedAt).reduce((s, p) => {
        const last = [...p.valuations].sort((a, b) => a.date.getTime() - b.date.getTime()).pop();
        return s + (last?.estimatedValue ?? p.amountInvested);
      }, 0);

      const debtRemaining = allDebts.filter((d) => d.userId === uid).reduce((s, d) => {
        const prepaid = d.prepayments.reduce((ps, p) => ps + p.amount, 0);
        return s + computeLoanState(d.amount, d.interestRatePct, d.durationMonths, d.monthlyPayment, new Date(d.startDate), prepaid).remainingBalance;
      }, 0);

      netWorths.push(liquid + listedValue + privateValue - debtRemaining);
    }

    financialStats = {
      sampleSize: savingsRates.length,
      savingsRateDistribution: bucketize(
        savingsRates,
        [0, 10, 20, 30, 40],
        ["< 0%", "0-10%", "10-20%", "20-30%", "30-40%", "40%+"]
      ),
      netWorthDistribution: bucketize(
        netWorths,
        [0, 5000, 20000, 50000, 100000],
        ["< 0€", "0-5k€", "5-20k€", "20-50k€", "50-100k€", "100k€+"]
      ),
    };
  }

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
    financialStats,
    signupsByMonth,
    users: userList,
  });
}
