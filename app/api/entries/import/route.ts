import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorized } from "@/lib/session";
import { parseImportWorkbook, buildTemplateWorkbook } from "@/lib/excel";
import { GROUP_ORDER } from "@/lib/categories";

// GET /api/entries/import -> downloads a blank template pre-filled with the
// user's current categories (see /input "Importer un Excel").
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const categories = await prisma.categoryConfig.findMany({
    where: { userId, archived: false },
    orderBy: [{ group: "asc" }, { order: "asc" }],
  });

  const buffer = buildTemplateWorkbook(
    categories.map((c) => ({ group: c.group as (typeof GROUP_ORDER)[number], name: c.name }))
  );

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modele-import-finances.xlsx"',
    },
  });
}

// POST /api/entries/import (multipart/form-data, field "file")
// Parses the workbook, auto-creates any category not already present, then
// upserts every entry + starting balance row found.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { entries, balances, errors } = parseImportWorkbook(buffer);

  const existingCategories = await prisma.categoryConfig.findMany({ where: { userId } });
  const catKey = (group: string, name: string) => `${group}::${name.toLowerCase()}`;
  const categoryMap = new Map(
    existingCategories.map((c) => [catKey(c.group, c.name), c])
  );

  let created = 0;
  for (const row of entries) {
    const key = catKey(row.group, row.category);
    if (!categoryMap.has(key)) {
      const count = await prisma.categoryConfig.count({
        where: { userId, group: row.group },
      });
      const newCat = await prisma.categoryConfig.create({
        data: { userId, group: row.group, name: row.category, order: count },
      });
      categoryMap.set(key, newCat);
      created++;
    }
  }

  let entriesSaved = 0;
  await prisma.$transaction(
    entries.map((row) => {
      const cat = categoryMap.get(catKey(row.group, row.category))!;
      entriesSaved++;
      return prisma.entry.upsert({
        where: {
          userId_year_month_categoryId: {
            userId,
            year: row.year,
            month: row.month,
            categoryId: cat.id,
          },
        },
        update: { amount: row.amount, note: row.note },
        create: {
          userId,
          year: row.year,
          month: row.month,
          group: row.group,
          categoryId: cat.id,
          amount: row.amount,
          note: row.note,
        },
      });
    })
  );

  let balancesSaved = 0;
  for (const b of balances) {
    await prisma.monthSummary.upsert({
      where: { userId_year_month: { userId, year: b.year, month: b.month } },
      update: { startingBalance: b.startingBalance },
      create: { userId, year: b.year, month: b.month, startingBalance: b.startingBalance },
    });
    balancesSaved++;
  }

  return NextResponse.json({
    entriesSaved,
    balancesSaved,
    categoriesCreated: created,
    errors,
  });
}
