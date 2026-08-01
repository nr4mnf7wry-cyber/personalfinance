import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorized } from "@/lib/session";
import { buildMonthSummary } from "@/lib/calculations";
import type { CategoryGroupKey } from "@/lib/categories";

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

// GET /api/entries/summary?year=2026&month=8
// Returns the stored starting balance (if any) plus a suggested value
// derived from the previous month's computed ending balance, for prefill.
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!year || !month) {
    return NextResponse.json({ error: "year/month requis" }, { status: 400 });
  }

  const stored = await prisma.monthSummary.findUnique({
    where: { userId_year_month: { userId, year, month } },
  });

  const prev = prevMonth(year, month);
  const [prevSummary, prevEntries] = await Promise.all([
    prisma.monthSummary.findUnique({
      where: { userId_year_month: { userId, year: prev.year, month: prev.month } },
    }),
    prisma.entry.findMany({ where: { userId, year: prev.year, month: prev.month } }),
  ]);

  let suggested: number | null = null;
  if (prevSummary || prevEntries.length > 0) {
    const s = buildMonthSummary(
      prev.year,
      prev.month,
      prevEntries.map((e) => ({ group: e.group as CategoryGroupKey, amount: e.amount })),
      prevSummary?.startingBalance ?? 0
    );
    suggested = s.endingBalance;
  }

  return NextResponse.json({
    startingBalance: stored?.startingBalance ?? null,
    suggestedStartingBalance: suggested,
  });
}

// POST /api/entries/summary { year, month, startingBalance }
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const body = await req.json();
  const year = Number(body.year);
  const month = Number(body.month);
  const startingBalance = Number(body.startingBalance);
  if (!year || !month || Number.isNaN(startingBalance)) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const summary = await prisma.monthSummary.upsert({
    where: { userId_year_month: { userId, year, month } },
    update: { startingBalance },
    create: { userId, year, month, startingBalance },
  });

  return NextResponse.json({ summary });
}
