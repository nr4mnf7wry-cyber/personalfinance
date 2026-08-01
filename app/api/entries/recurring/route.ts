import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorized } from "@/lib/session";

// GET /api/entries/recurring?year=2026&month=8
// For every active category, finds the most recent prior month with an
// entered amount and returns it, so the input form can pre-fill recurring
// costs (rent, subscriptions, ...) with a single click per field.
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!year || !month) {
    return NextResponse.json({ error: "year/month requis" }, { status: 400 });
  }

  const categories = await prisma.categoryConfig.findMany({
    where: { userId, archived: false },
  });

  const suggestions: Record<string, { amount: number; fromYear: number; fromMonth: number }> = {};

  for (const cat of categories) {
    const previous = await prisma.entry.findFirst({
      where: {
        userId,
        categoryId: cat.id,
        OR: [
          { year: { lt: year } },
          { year, month: { lt: month } },
        ],
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    if (previous) {
      suggestions[cat.id] = {
        amount: previous.amount,
        fromYear: previous.year,
        fromMonth: previous.month,
      };
    }
  }

  return NextResponse.json({ suggestions });
}
