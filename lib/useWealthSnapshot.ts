"use client";

import { useEffect, useMemo, useState } from "react";
import { Entry, computeMonthTotals, capToCurrentMonth, Balance } from "@/lib/aggregate";
import { computeLoanState } from "@/lib/loan";

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

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

  const positions = useMemo(() => {
    const map = new Map<string, { ticker: string; quantity: number; currency: string }>();
    for (const t of transactions) {
      const cur = map.get(t.ticker) ?? { ticker: t.ticker, quantity: 0, currency: t.currency ?? "EUR" };
      cur.quantity += t.type === "vente" ? -t.quantity : t.quantity;
      map.set(t.ticker, cur);
    }
    return Array.from(map.values()).filter((p) => p.quantity > 0.0001);
  }, [transactions]);

  useEffect(() => {
    positions.forEach((p) => {
      if (prices[p.ticker] !== undefined) return;
      fetch(`/api/stock-price?ticker=${encodeURIComponent(p.ticker)}`)
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

  const liquidBalance = useMemo(() => {
    const valid = balancesCapped.filter((b) => b.endBalance != null);
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

  const privateInvestedValue = useMemo(() => {
    return privateInvestments.filter((inv) => !inv.closedAt).reduce((s, inv) => {
      const last = [...(inv.valuations ?? [])].sort((a: any, b: any) => a.date.localeCompare(b.date)).pop();
      const value = last?.estimatedValue ?? inv.amountInvested;
      return s + value * (rates[inv.currency] ?? 1);
    }, 0);
  }, [privateInvestments, rates]);

  const portfolioValue = listedPortfolioValue + privateInvestedValue;

  const totalDebtRemaining = useMemo(() => {
    return debts.reduce((s, d) => {
      const prepaid = (d.prepayments ?? []).reduce((ps: number, p: any) => ps + p.amount, 0);
      const state = computeLoanState(d.amount, d.interestRatePct, d.durationMonths, d.monthlyPayment, new Date(d.startDate), prepaid);
      return s + state.remainingBalance;
    }, 0);
  }, [debts]);

  const totalWealth = (liquidBalance ?? 0) + portfolioValue - totalDebtRemaining;

  const avgMonthlySavings = useMemo(() => {
    const last6 = monthTotals.slice(-6);
    if (last6.length === 0) return 0;
    return last6.reduce((s, t) => s + t.epargne, 0) / last6.length;
  }, [monthTotals]);

  return {
    loading, entries, monthTotals, balancesCapped, transactions, privateInvestments, debts, rates,
    liquidBalance, listedPortfolioValue, privateInvestedValue, portfolioValue, totalDebtRemaining,
    totalWealth, avgMonthlySavings,
  };
}
