import { MonthTotals, sum } from "./aggregate";

export type Entry = { year: number; month: number; group: string; category: string; amount: number };
export type CategoryFlag = { name: string; group: string; isInvestment: boolean; isEssential?: boolean | null };
export type InvestmentTx = { date: string; amount: number; currency: string; type: string };

const HOUSING_KEYWORDS = ["rent", "loyer", "hypoth", "mortgage", "logement"];

export type Ratios = {
  savingsRate: number;           // épargne / revenus
  fixedToIncome: number;         // dépenses fixes / revenus
  variableToIncome: number;      // dépenses variables / revenus
  investmentRate: number;        // capital net investi en bourse (achats - ventes) / revenus
  housingRatio: number;          // loyer/hypothèque / revenus
  discretionaryExpenses: number; // dépenses marquées "non essentielles" (moyenne période, en €)
  avgMonthlyIncome: number;      // revenu moyen mensuel, en €
  avgSavings: number;            // épargne moyenne, en €
  avgCostOfLiving: number;       // coût moyen de la vie (fixes + variables), en €
};

// Seuils de référence usuels en gestion de finances personnelles (règles générales,
// pas un conseil personnalisé) — utilisés pour juger si un ratio est sain ou non.
// direction "low" = plus bas est meilleur, "high" = plus haut est meilleur.
export const RATIO_BENCHMARKS: Partial<Record<keyof Ratios, { good: number; warning: number; direction: "low" | "high" }>> = {
  savingsRate: { good: 20, warning: 10, direction: "high" },
  fixedToIncome: { good: 50, warning: 65, direction: "low" },
  variableToIncome: { good: 30, warning: 45, direction: "low" },
  investmentRate: { good: 15, warning: 5, direction: "high" },
  housingRatio: { good: 30, warning: 40, direction: "low" },
};

export function judgeRatio(key: keyof Ratios, value: number): "good" | "neutral" | "warning" | null {
  const b = RATIO_BENCHMARKS[key];
  if (!b) return null;
  if (b.direction === "high") {
    if (value >= b.good) return "good";
    if (value >= b.warning) return "neutral";
    return "warning";
  } else {
    if (value <= b.good) return "good";
    if (value <= b.warning) return "neutral";
    return "warning";
  }
}

export function computeRatios(
  monthTotals: MonthTotals[],
  entries: Entry[],
  categories: CategoryFlag[],
  transactions: InvestmentTx[] = [],
  rates: Record<string, number> = { EUR: 1 }
): Ratios {
  if (monthTotals.length === 0) {
    return {
      savingsRate: 0, fixedToIncome: 0, variableToIncome: 0, investmentRate: 0,
      housingRatio: 0, discretionaryExpenses: 0, avgMonthlyIncome: 0, avgSavings: 0, avgCostOfLiving: 0,
    };
  }

  const totalRevenus = sum(monthTotals.map((t) => t.revenus));
  const totalFixes = sum(monthTotals.map((t) => t.fixes));
  const totalVariables = sum(monthTotals.map((t) => t.variables));
  const totalEpargne = sum(monthTotals.map((t) => t.epargne));

  // Capital net investi en bourse sur la période (achats - ventes, converti en EUR) —
  // basé sur les vraies transactions de /investments, pas sur une catégorie de saisie
  const totalInvested = transactions.reduce((s, t) => {
    const signed = t.type === "vente" ? -t.amount : t.amount;
    return s + signed * (rates[t.currency] ?? 1);
  }, 0);

  const housingCategoryNames = new Set(
    categories.filter((c) => HOUSING_KEYWORDS.some((k) => c.name.toLowerCase().includes(k))).map((c) => c.name)
  );
  const totalHousing = entries
    .filter((e) => housingCategoryNames.has(e.category))
    .reduce((s, e) => s + e.amount, 0);

  // Dépenses discrétionnaires = catégories explicitement marquées "non essentielles"
  // (isEssential === false). Une catégorie non classée (null/undefined) est ignorée
  // ici plutôt que comptée par défaut, pour ne pas fausser le ratio avant classement.
  const nonEssentialNames = new Set(categories.filter((c) => c.isEssential === false).map((c) => c.name));
  const totalDiscretionary = entries
    .filter((e) => nonEssentialNames.has(e.category))
    .reduce((s, e) => s + e.amount, 0);

  const n = monthTotals.length;

  return {
    savingsRate: totalRevenus > 0 ? (totalEpargne / totalRevenus) * 100 : 0,
    fixedToIncome: totalRevenus > 0 ? (totalFixes / totalRevenus) * 100 : 0,
    variableToIncome: totalRevenus > 0 ? (totalVariables / totalRevenus) * 100 : 0,
    investmentRate: totalRevenus > 0 ? (totalInvested / totalRevenus) * 100 : 0,
    housingRatio: totalRevenus > 0 ? (totalHousing / totalRevenus) * 100 : 0,
    discretionaryExpenses: totalDiscretionary / n,
    avgMonthlyIncome: totalRevenus / n,
    avgSavings: totalEpargne / n,
    avgCostOfLiving: (totalFixes + totalVariables) / n,
  };
}
