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

export type Balance = { year: number; month: number; startBalance: number | null; endBalance: number | null };

export function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// L'épargne réelle d'un mois = ce qu'il reste effectivement en banque en plus
// (solde fin - solde début), et non la somme des catégories "épargne" saisies
// (qui ne reflètent que ce qui a été catégorisé, pas la réalité du compte).
// Si aucun solde n'est renseigné pour le mois, on retombe sur l'ancien calcul
// (somme des catégories du groupe "epargne") pour ne pas casser l'historique
// importé avant la mise en place du suivi de solde.
export function computeMonthTotals(entries: Entry[], balances: Balance[] = []): MonthTotals[] {
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

  const balanceMap = new Map(balances.map((b) => [monthKey(b.year, b.month), b]));

  const result = Array.from(groups.values()).map((t) => {
    t.depenses = t.fixes + t.variables;
    t.net = t.revenus - t.depenses;

    const b = balanceMap.get(monthKey(t.year, t.month));
    if (b && b.startBalance != null && b.endBalance != null) {
      t.epargne = b.endBalance - b.startBalance;
    }
    // sinon : t.epargne reste la somme des catégories "epargne" (calculée plus haut)

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

// Compare un mois à celui juste avant (et non l'année précédente), catégorie par
// catégorie — utile pour repérer les postes qui ont le plus bougé d'un mois à l'autre
export function momByCategory(entries: Entry[], year: number, month: number) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const current = entries.filter((e) => e.year === year && e.month === month && (e.group === "fixes" || e.group === "variables"));
  const previous = entries.filter((e) => e.year === prevYear && e.month === prevMonth && (e.group === "fixes" || e.group === "variables"));

  const categories = Array.from(new Set([...current, ...previous].map((e) => e.category)));

  return categories
    .map((category) => {
      const cur = current.find((e) => e.category === category)?.amount ?? 0;
      const prev = previous.find((e) => e.category === category)?.amount ?? 0;
      return { category, current: cur, previous: prev, delta: cur - prev };
    })
    .filter((r) => r.current !== 0 || r.previous !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

// Compare un mois donné au même mois de l'année précédente, par catégorie
export function yoyByCategory(entries: Entry[], year: number, month: number) {
  const current = entries.filter((e) => e.year === year && e.month === month);
  const previous = entries.filter((e) => e.year === year - 1 && e.month === month);

  const categories = Array.from(new Set([...current, ...previous].map((e) => e.category)));

  return categories
    .map((category) => {
      const cur = current.find((e) => e.category === category)?.amount ?? 0;
      const prev = previous.find((e) => e.category === category)?.amount ?? 0;
      const deltaPct = prev !== 0 ? ((cur - prev) / prev) * 100 : cur !== 0 ? 100 : 0;
      return { category, current: cur, previous: prev, deltaPct };
    })
    .filter((r) => r.current !== 0 || r.previous !== 0)
    .sort((a, b) => Math.max(b.current, b.previous) - Math.max(a.current, a.previous));
}

export function ytdCumulative(monthTotals: MonthTotals[], year: number, field: "net" | "epargne" = "net") {
  const months = monthTotals.filter((t) => t.year === year).sort((a, b) => a.month - b.month);
  let running = 0;
  return months.map((m) => {
    running += m[field];
    return { month: m.month, cumulative: running };
  });
}
