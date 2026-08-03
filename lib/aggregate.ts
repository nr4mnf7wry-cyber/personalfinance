import { Group } from "./categories";

export type Entry = {
  year: number;
  month: number;
  group: Group;
  category: string;
  amount: number;
};

export type MonthTotals = {
  year: number;
  month: number;
  revenus: number;
  fixes: number;
  variables: number;
  epargne: number;
  depenses: number; // fixes + variables
  net: number; // revenus - depenses (avant épargne investie)
  savingsRate: number; // epargne / revenus, en %
};

export function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function computeMonthTotals(entries: Entry[]): MonthTotals[] {
  const groups = new Map<string, MonthTotals>();

  for (const e of entries) {
    const key = monthKey(e.year, e.month);
    if (!groups.has(key)) {
      groups.set(key, {
        year: e.year, month: e.month,
        revenus: 0, fixes: 0, variables: 0, epargne: 0,
        depenses: 0, net: 0, savingsRate: 0,
      });
    }
    const t = groups.get(key)!;
    t[e.group] += e.amount;
  }

  const result = Array.from(groups.values()).map((t) => {
    t.depenses = t.fixes + t.variables;
    t.net = t.revenus - t.depenses;
    t.savingsRate = t.revenus > 0 ? (t.epargne / t.revenus) * 100 : 0;
    return t;
  });

  return result.sort((a, b) => a.year - b.year || a.month - b.month);
}

// Solde net cumulé mois par mois (proxy de "patrimoine dans le temps")
export function computeRunningBalance(monthTotals: MonthTotals[]) {
  let running = 0;
  return monthTotals.map((t) => {
    running += t.net;
    return { ...t, runningBalance: running };
  });
}

export function movingAverage(values: number[], window: number) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export function topExpenses(entries: Entry[], year: number, month: number, n = 5) {
  return entries
    .filter((e) => e.year === year && e.month === month && (e.group === "fixes" || e.group === "variables"))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

export function expensesByCategory(entries: Entry[], year: number, month: number) {
  return entries.filter(
    (e) => e.year === year && e.month === month && (e.group === "fixes" || e.group === "variables")
  );
}

export function yearTotals(monthTotals: MonthTotals[], year: number) {
  const months = monthTotals.filter((t) => t.year === year);
  return {
    year,
    revenus: sum(months.map((m) => m.revenus)),
    depenses: sum(months.map((m) => m.depenses)),
    epargne: sum(months.map((m) => m.epargne)),
  };
}

export function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

// Exclut tout mois futur (au-delà du mois calendaire réel) — utilisé par toutes
// les pages dashboard pour ne jamais afficher de données "prédites" comme réelles
export function capToCurrentMonth(entries: Entry[]): Entry[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return entries.filter((e) => e.year < y || (e.year === y && e.month <= m));
}

// Compare un mois donné au même mois de l'année précédente, par catégorie
export function yoyByCategory(entries: Entry[], year: number, month: number) {
  const current = entries.filter((e) => e.year === year && e.month === month);
  const previous = entries.filter((e) => e.year === year - 1 && e.month === month);

  const categories = Array.from(new Set([...current, ...previous].map((e) => e.category)));

  return categories.map((category) => {
    const cur = current.find((e) => e.category === category)?.amount ?? 0;
    const prev = previous.find((e) => e.category === category)?.amount ?? 0;
    const deltaPct = prev !== 0 ? ((cur - prev) / prev) * 100 : cur !== 0 ? 100 : 0;
    return { category, current: cur, previous: prev, deltaPct };
  });
}

export function ytdCumulative(monthTotals: MonthTotals[], year: number, field: "net" | "epargne" = "net") {
  const months = monthTotals.filter((t) => t.year === year).sort((a, b) => a.month - b.month);
  let running = 0;
  return months.map((m) => {
    running += m[field];
    return { month: m.month, cumulative: running };
  });
}
