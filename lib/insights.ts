import { MonthTotals, sum } from "./aggregate";

export type Insight = { text: string; tone: "positive" | "negative" | "neutral" };

// Compare la moyenne du taux d'épargne sur les 3 derniers mois vs les 3 précédents
export function savingsRateTrendInsight(monthTotals: MonthTotals[]): Insight | null {
  if (monthTotals.length < 4) return null;
  const last3 = monthTotals.slice(-3);
  const prev3 = monthTotals.slice(-6, -3);
  if (prev3.length === 0) return null;

  const avgLast3 = sum(last3.map((t) => t.savingsRate)) / last3.length;
  const avgPrev3 = sum(prev3.map((t) => t.savingsRate)) / prev3.length;
  const delta = avgLast3 - avgPrev3;

  if (Math.abs(delta) < 1) {
    return { text: `Taux d'épargne stable autour de ${avgLast3.toFixed(0)}% sur les 3 derniers mois.`, tone: "neutral" };
  }
  return {
    text: `Taux d'épargne moyen de ${avgLast3.toFixed(0)}% sur les 3 derniers mois, ${delta > 0 ? "en hausse" : "en baisse"} de ${Math.abs(delta).toFixed(1)} pt vs le trimestre précédent.`,
    tone: delta > 0 ? "positive" : "negative",
  };
}

// Concentration des dépenses du mois : quelle part représente le plus gros poste
export function expenseConcentrationInsight(
  categoryAmounts: { category: string; amount: number }[],
  totalExpenses: number
): Insight | null {
  if (categoryAmounts.length === 0 || totalExpenses <= 0) return null;
  const sorted = [...categoryAmounts].sort((a, b) => b.amount - a.amount);
  const top = sorted[0];
  const share = (top.amount / totalExpenses) * 100;
  return {
    text: `"${top.category}" représente ${share.toFixed(0)}% des dépenses de ce mois — le poste le plus significatif.`,
    tone: share > 40 ? "negative" : "neutral",
  };
}

// Nombre de mois consécutifs (les plus récents) avec un solde net positif
export function cashflowStreakInsight(monthTotals: MonthTotals[]): Insight | null {
  if (monthTotals.length === 0) return null;
  const reversed = [...monthTotals].reverse();
  const allPositive = reversed[0].net >= 0;
  let streak = 0;
  for (const t of reversed) {
    if (allPositive ? t.net >= 0 : t.net < 0) streak++;
    else break;
  }
  if (streak <= 1) return null;
  return allPositive
    ? { text: `${streak} mois consécutifs avec un flux de trésorerie positif.`, tone: "positive" }
    : { text: `${streak} mois consécutifs avec un flux de trésorerie négatif — à surveiller.`, tone: "negative" };
}
