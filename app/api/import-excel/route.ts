import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";
import { ALL_CATEGORIES } from "@/lib/categories";

// POST /api/import-excel : reçoit un fichier .xlsx (multipart/form-data),
// tente de mapper automatiquement les colonnes vers les catégories connues,
// et renvoie un aperçu (rien n'est écrit en base ici — confirmation faite via /api/entries).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  // Normalisation simple pour matcher les libellés de colonnes aux catégories connues
  const normalize = (s: string) =>
    s
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const knownByName = new Map(ALL_CATEGORIES.map((c) => [normalize(c.category), c]));

  const monthColumn =
    Object.keys(rows[0] ?? {}).find((k) => /mois|month|date/i.test(k)) ?? null;

  const preview = rows.map((row) => {
    const mapped: { column: string; matchedCategory: string | null; group: string | null; value: any }[] = [];
    for (const [col, value] of Object.entries(row)) {
      if (col === monthColumn) continue;
      const match = knownByName.get(normalize(col));
      mapped.push({
        column: col,
        matchedCategory: match?.category ?? null,
        group: match?.group ?? null,
        value,
      });
    }
    return {
      monthLabel: monthColumn ? row[monthColumn] : null,
      lines: mapped,
    };
  });

  return NextResponse.json({
    rowCount: rows.length,
    monthColumn,
    unmatchedColumns: preview[0]?.lines.filter((l) => !l.matchedCategory).map((l) => l.column) ?? [],
    preview,
  });
}
