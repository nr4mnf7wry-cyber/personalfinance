import type { CategoryGroupKey } from "@/lib/categories";
import type { MonthSummaryDTO } from "@/types";

export type MinimalEntry = { group: CategoryGroupKey; amount: number };

export function sumByGroup(
  entries: MinimalEntry[]
): Record<CategoryGroupKey, number> {
  const totals: Record<CategoryGroupKey, number> = {
    income: 0,
    fixed: 0,
    variable: 0,
    savings: 0,
  };
  for (const e of entries) {
    totals[e.group] += e.amount;
  }
  return totals;
}

export function buildMonthSummary(
  year: number,
  month: number,
  entries: MinimalEntry[],
  startingBalance: number
): MonthSummaryDTO {
  const totals = sumByGroup(entries);
  const totalExpenses = totals.fixed + totals.variable;
  const endingBalance =
    startingBalance + totals.income - totalExpenses - totals.savings;
  const savingsRate =
    totals.income > 0 ? (totals.savings / totals.income) * 100 : null;

  return {
    year,
    month,
    startingBalance,
    totalIncome: totals.income,
    totalFixed: totals.fixed,
    totalVariable: totals.variable,
    totalSavings: totals.savings,
    totalExpenses,
    endingBalance,
    savingsRate,
  };
}

/** % change from `previous` to `current`. Null when `previous` is 0 (undefined ratio). */
export function pctChange(
  current: number,
  previous: number
): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function movingAverage(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / window;
  });
}

/** Fixed charges (rent, utilities, etc.) as a % of income — a classic budgeting ratio. */
export function fixedToIncomeRatio(totalFixed: number, totalIncome: number): number | null {
  if (totalIncome <= 0) return null;
  return (totalFixed / totalIncome) * 100;
}

/** "Reste à vivre": what's left after fixed costs and savings, before variable spending. */
export function disposableIncome(summary: MonthSummaryDTO): number {
  return summary.totalIncome - summary.totalFixed - summary.totalSavings;
}
