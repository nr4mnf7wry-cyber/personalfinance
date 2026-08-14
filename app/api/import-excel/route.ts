import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";

type Group = "revenus" | "fixes" | "variables" | "epargne";

// Ce parseur est conçu pour un format "budget annuel" où :
// - les catégories sont en LIGNES (colonne A)
// - les mois sont en COLONNES, avec l'année indiquée au-dessus (souvent une cellule
//   fusionnée, donc seule la première colonne du bloc de l'année porte la valeur)
// Deux variantes supportées :
// - AVEC des lignes de section en gras (Income / Fixed expenses / Variable / Savings)
//   au-dessus des catégories -> le groupe est pris de la section
// - SANS section du tout (juste une liste plate de catégories) -> le groupe est
//   deviné par mots-clés (voir classifyGroup), et l'utilisateur peut corriger
//   chaque catégorie dans l'aperçu avant de confirmer l'import.
// La section "Account Split" (soldes de comptes) est ignorée : ce n'est pas une
// catégorie de budget.

const MONTH_NAMES: Record<string, number> = {
  janvier: 1, january: 1, jan: 1,
  février: 2, fevrier: 2, february: 2, feb: 2, februar: 2,
  mars: 3, march: 3, maart: 3,
  avril: 4, april: 4,
  mai: 5, may: 5, mei: 5,
  juin: 6, june: 6, juni: 6,
  juillet: 7, july: 7, juli: 7,
  août: 8, aout: 8, august: 8, augustus: 8,
  septembre: 9, september: 9, sept: 9,
  octobre: 10, october: 10, oktober: 10, okt: 10,
  novembre: 11, november: 11,
  décembre: 12, decembre: 12, december: 12, dezember: 12,
};

// Sections reconnues comme en-têtes de groupe (pas des catégories elles-mêmes)
const GROUP_HEADERS: Record<string, Group> = {
  income: "revenus", revenus: "revenus", revenu: "revenus",
  "fixed expenses": "fixes", "dépenses fixes": "fixes", "depenses fixes": "fixes", fixed: "fixes",
  variable: "variables", "dépenses variables": "variables", "depenses variables": "variables", variables: "variables",
  savings: "epargne", épargne: "epargne", epargne: "epargne",
};

// Sections à ignorer complètement (pas des catégories de budget)
const IGNORED_SECTIONS = new Set(["account split", "répartition des comptes"]);

// Mots-clés pour deviner le groupe d'une catégorie sans section explicite au-dessus.
// Inclut quelques marques/fournisseurs belges courants (opérateurs telecom, mutuelles,
// assureurs) en plus des mots génériques. Reste une SUPPOSITION, corrigible ensuite.
const REVENUE_KEYWORDS = ["salary", "salaire", "income", "revenu", "wage", "freelance", "bonus", "remboursement", "refund", "pension", "loyer percu", "loyer perçu"];
const SAVINGS_KEYWORDS = ["saving", "épargne", "epargne", "investment", "investissement", "retirement"];
const FIXED_KEYWORDS = [
  "rent", "loyer", "hypoth", "mortgage", "credit", "crédit", "pret", "prêt",
  "insurance", "assurance", "mutuelle", "mutuality",
  "subscription", "abonnement", "netflix", "spotify", "disney", "prime",
  "phone", "telephone", "téléphone", "internet", "electric", "électric", "gas", "gaz", "water", "eau",
  "proximus", "orange", "base", "telenet", "voo", "vivium", "ethias", "axa", "belfius assur",
];

function classifyGroup(label: string): Group {
  const n = normalize(label);
  if (REVENUE_KEYWORDS.some((k) => n.includes(k))) return "revenus";
  if (SAVINGS_KEYWORDS.some((k) => n.includes(k))) return "epargne";
  if (FIXED_KEYWORDS.some((k) => n.includes(k))) return "fixes";
  return "variables"; // valeur par défaut la plus sûre pour une dépense non reconnue
}

function normalize(s: any) {
  return s?.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() ?? "";
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

  if (rows.length < 2) {
    return NextResponse.json({ error: "Feuille vide ou format non reconnu" }, { status: 400 });
  }

  // 1. Trouver la ligne d'en-tête des mois : la première ligne contenant au moins
  //    un nom de mois reconnu (peu importe la langue).
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (rows[i].some((cell) => MONTH_NAMES[normalize(cell)])) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex === -1) {
    return NextResponse.json({ error: "Impossible de trouver la ligne des mois (Janvier, Février...)" }, { status: 400 });
  }

  // 2. Trouver l'année pour chaque colonne : on regarde la/les ligne(s) au-dessus de
  //    l'en-tête des mois, et on propage la dernière valeur numérique à 4 chiffres
  //    rencontrée de gauche à droite (gère les cellules fusionnées).
  const yearRow = headerRowIndex > 0 ? rows[headerRowIndex - 1] : [];
  const columnYears: (number | null)[] = [];
  let lastYear: number | null = null;
  for (let col = 0; col < rows[headerRowIndex].length; col++) {
    const raw = yearRow[col];
    const num = Number(raw);
    if (raw != null && num >= 1900 && num <= 2100) lastYear = num;
    columnYears[col] = lastYear;
  }
  const fallbackYear = new Date().getFullYear();

  // 3. Associer chaque colonne pertinente à { year, month }
  const monthColumns: { col: number; year: number; month: number }[] = [];
  rows[headerRowIndex].forEach((cell, col) => {
    const month = MONTH_NAMES[normalize(cell)];
    if (month) {
      monthColumns.push({ col, year: columnYears[col] ?? fallbackYear, month });
    }
  });

  // 4. Parcourir les lignes suivantes : détecter les sections si présentes, ignorer
  //    "Account Split", et pour chaque catégorie, utiliser le groupe de la section
  //    si connu, sinon deviner par mots-clés.
  type ParsedLine = { year: number; month: number; group: Group; category: string; amount: number };
  const parsedLines: ParsedLine[] = [];

  let currentGroup: Group | null = null;
  let ignoring = false;

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const label = row[0];
    const normLabel = normalize(label);
    if (!normLabel) continue;

    if (IGNORED_SECTIONS.has(normLabel)) {
      ignoring = true;
      continue;
    }
    if (GROUP_HEADERS[normLabel]) {
      currentGroup = GROUP_HEADERS[normLabel];
      ignoring = false;
      continue;
    }
    if (ignoring) continue;

    const group = currentGroup ?? classifyGroup(label.toString());

    // Désambiguïsation de "Other" selon le groupe, pour éviter toute confusion
    let categoryName = label.toString().trim();
    if (normalize(categoryName) === "other") {
      categoryName = group === "revenus" ? "Other income" : "Other expenses";
    }

    for (const { col, year, month } of monthColumns) {
      const raw = row[col];
      if (raw === null || raw === undefined || raw === "") continue;
      const amount = Number(raw);
      if (Number.isNaN(amount)) continue;
      parsedLines.push({ year, month, group, category: categoryName, amount });
    }
  }

  // 5. Catégories distinctes détectées, avec leur groupe (deviné ou issu d'une section)
  //    — l'utilisateur pourra corriger chacune avant de confirmer l'import.
  const categoriesMap = new Map<string, Group>();
  for (const l of parsedLines) if (!categoriesMap.has(l.category)) categoriesMap.set(l.category, l.group);
  const categories = Array.from(categoriesMap.entries()).map(([name, group]) => ({ name, group }));

  // 6. Regrouper par (année, mois) pour l'aperçu
  const byMonth = new Map<string, { year: number; month: number; lines: ParsedLine[] }>();
  for (const line of parsedLines) {
    const key = `${line.year}-${line.month}`;
    if (!byMonth.has(key)) byMonth.set(key, { year: line.year, month: line.month, lines: [] });
    byMonth.get(key)!.lines.push(line);
  }
  const months = Array.from(byMonth.values()).sort((a, b) => a.year - b.year || a.month - b.month);

  return NextResponse.json({
    monthCount: months.length,
    lineCount: parsedLines.length,
    categories,
    months,
  });
}
