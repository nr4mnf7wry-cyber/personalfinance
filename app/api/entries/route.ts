import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorized } from "@/lib/session";
import type { CategoryGroupKey } from "@/lib/categories";

// GET /api/entries?year=2026&month=8        -> one month
// GET /api/entries?fromYear=2024&fromMonth=1&toYear=2026&toMonth=8 -> range (history table)
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const fromYear = searchParams.get("fromYear");
  const toYear = searchParams.get("toYear");

  let where: { userId: string; year?: number | { gte?: number; lte?: number }; month?: number } = {
    userId,
  };

  if (year && month) {
    where = { userId, year: Number(year), month: Number(month) };
  } else if (fromYear && toYear) {
    where = { userId, year: { gte: Number(fromYear), lte: Number(toYear) } };
  }

  const entries = await prisma.entry.findMany({
    where,
    include: { category: true },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      year: e.year,
      month: e.month,
      group: e.group as CategoryGroupKey,
      categoryId: e.categoryId,
      categoryName: e.category.name,
      amount: e.amount,
      note: e.note,
    })),
  });
}

// POST /api/entries  { year, month, entries: [{ categoryId, amount, note? }] }
// Saves the whole month form in one batch (upsert per category).
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const body = await req.json();
  const year = Number(body.year);
  const month = Number(body.month);
  const rows = (body.entries ?? []) as {
    categoryId: string;
    amount: number;
    note?: string;
  }[];

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "year/month invalides" }, { status: 400 });
  }

  const categoryIds = rows.map((r) => r.categoryId);
  const categories = await prisma.categoryConfig.findMany({
    where: { id: { in: categoryIds }, userId },
  });
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const results = await prisma.$transaction(
    rows
      .filter((r) => categoryById.has(r.categoryId))
      .map((r) => {
        const cat = categoryById.get(r.categoryId)!;
        return prisma.entry.upsert({
          where: {
            userId_year_month_categoryId: {
              userId,
              year,
              month,
              categoryId: r.categoryId,
            },
          },
          update: { amount: r.amount, note: r.note },
          create: {
            userId,
            year,
            month,
            group: cat.group,
            categoryId: r.categoryId,
            amount: r.amount,
            note: r.note,
          },
        });
      })
  );

  return NextResponse.json({ saved: results.length });
}
