"use client";

import { useEffect, useMemo, useState } from "react";
import { Entry, computeMonthTotals, capToCurrentMonth, Balance } from "@/lib/aggregate";
import { computeLoanState } from "@/lib/loan";

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

// Dernier jour du mois précédent — la date de référence pour le calcul du patrimoine
// net (pas "aujourd'hui" : on veut une valeur figée et cohérente avec le dernier
// mois clos, pas un mélange entre soldes de fin de mois et cours boursiers du jour).
const now = new Date();
const referenceDate = new Date(now.getFullYear(), now.getMonth(), 0);
const referenceDateStr = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, "0")}-${String(referenceDate.getDate()).padStart(2, "0")}`;

export function useWealthSnapshot() {
  const [entriesRaw, setEntriesRaw] = useState<Entry[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [privateInvestments, setPrivateInvestments] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({ EUR: 1 });
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/entries").then((r) => r.json()),
      fetch("/api/balances").then((r) => r.json()),
      fetch("/api/investments").then((r) => r.json()),
      fetch("/api/private-investments").then((r) => r.json()),
      fetch("/api/debts").then((r) => r.json()),
    ]).then(([e, b, t, pi, d]) => {
      setEntriesRaw(e); setBalances(b); setTransactions(t); setPrivateInvestments(pi); setDebts(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const currencies = new Set(transactions.map((t) => t.currency).filter((c: string) => c && c !== "EUR"));
    currencies.forEach((c) => {
      if (rates[c] !== undefined) return;
      fetch(`/api/exchange-rate?from=${c}&to=EUR`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setRates((prev) => ({ ...prev, [c]: data?.rate ?? 1 })))
        .catch(() => setRates((prev) => ({ ...prev, [c]: 1 })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  // Positions détenues à la date de référence (achats - ventes survenus jusque-là)
  const positions = useMemo(() => {
    const map = new Map<string, { ticker: string; quantity: number; currency: string }>();
    for (const t of transactions) {
      if (new Date(t.date) > referenceDate) continue;
      const cur = map.get(t.ticker) ?? { ticker: t.ticker, quantity: 0, currency: t.currency ?? "EUR" };
      cur.quantity += t.type === "vente" ? -t.quantity : t.quantity;
      map.set(t.ticker, cur);
    }
    return Array.from(map.values()).filter((p) => p.quantity > 0.0001);
  }, [transactions]);

  // Cours de clôture au dernier jour du mois précédent (pas le cours en direct)
  useEffect(() => {
    positions.forEach((p) => {
      if (prices[p.ticker] !== undefined) return;
      fetch(`/api/stock-price?ticker=${encodeURIComponent(p.ticker)}&date=${referenceDateStr}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setPrices((prev) => ({ ...prev, [p.ticker]: data?.price ?? -1 })))
        .catch(() => setPrices((prev) => ({ ...prev, [p.ticker]: -1 })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  const entries = useMemo(() => capToCurrentMonth(entriesRaw), [entriesRaw]);
  const balancesCapped = useMemo(
    () => balances.filter((b) => b.year < CURRENT_YEAR || (b.year === CURRENT_YEAR && b.month <= CURRENT_MONTH)),
    [balances]
  );
  const monthTotals = useMemo(() => computeMonthTotals(entries, balancesCapped), [entries, balancesCapped]);

  // Solde liquide au dernier jour du mois précédent (le solde de fin de ce mois-là)
  const liquidBalance = useMemo(() => {
    const b = balancesCapped.find((b) => b.year === referenceDate.getFullYear() && b.month === referenceDate.getMonth() + 1);
    if (b?.endBalance != null) return b.endBalance;
    // à défaut, le dernier solde connu avant la date de référence
    const valid = balancesCapped.filter((b) => b.endBalance != null && (b.year < referenceDate.getFullYear() || (b.year === referenceDate.getFullYear() && b.month <= referenceDate.getMonth() + 1)));
    const latest = [...valid].sort((a, b) => (a.year - b.year) || (a.month - b.month)).pop();
    return latest?.endBalance ?? null;
  }, [balancesCapped]);

  const listedPortfolioValue = useMemo(() => {
    return positions.reduce((s, p) => {
      const price = prices[p.ticker];
      const value = price && price > 0 ? price * p.quantity : 0;
      return s + value * (rates[p.currency] ?? 1);
    }, 0);
  }, [positions, prices, rates]);

  // Investissements non cotés : dernière valorisation connue AU PLUS TARD à la date
  // de référence (pas une réévaluation postérieure qui n'était pas encore connue)
  const privateInvestedValue = useMemo(() => {
    return privateInvestments.filter((inv) => !inv.closedAt).reduce((s, inv) => {
      const validVals = (inv.valuations ?? []).filter((v: any) => new Date(v.date) <= referenceDate);
      const last = [...validVals].sort((a: any, b: any) => a.date.localeCompare(b.date)).pop();
      const value = last?.estimatedValue ?? inv.amountInvested;
      return s + value * (rates[inv.currency] ?? 1);
    }, 0);
  }, [privateInvestments, rates]);

  const portfolioValue = listedPortfolioValue + privateInvestedValue;

  // Solde restant dû des dettes, calculé à la même date de référence pour la cohérence
  const totalDebtRemaining = useMemo(() => {
    return debts.reduce((s, d) => {
      const prepaid = (d.prepayments ?? [])
        .filter((p: any) => new Date(p.date) <= referenceDate)
        .reduce((ps: number, p: any) => ps + p.amount, 0);
      const state = computeLoanState(d.amount, d.interestRatePct, d.durationMonths, d.monthlyPayment, new Date(d.startDate), prepaid, referenceDate);
      return s + state.remainingBalance;
    }, 0);
  }, [debts]);

  // Patrimoine NET = compte + portefeuille - dettes (au dernier jour du mois précédent)
  const totalWealth = (liquidBalance ?? 0) + portfolioValue - totalDebtRemaining;
  // "Ce que j'ai effectivement" (compte + investissements, SANS déduire les dettes) —
  // utilisé pour les objectifs, qui parlent d'actifs accumulés, pas de patrimoine net
  const grossAssets = (liquidBalance ?? 0) + portfolioValue;

  const avgMonthlySavings = useMemo(() => {
    const last6 = monthTotals.slice(-6);
    if (last6.length === 0) return 0;
    return last6.reduce((s, t) => s + t.epargne, 0) / last6.length;
  }, [monthTotals]);

  return {
    loading, entries, monthTotals, balancesCapped, transactions, privateInvestments, debts, rates,
    liquidBalance, listedPortfolioValue, privateInvestedValue, portfolioValue, totalDebtRemaining,
    totalWealth, grossAssets, avgMonthlySavings, referenceDate,
  };
}
