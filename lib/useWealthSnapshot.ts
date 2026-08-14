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

export function useWealthSnapshot() {
  const [entriesRaw, setEntriesRaw] = useState<Entry[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [privateInvestments, setPrivateInvestments] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({ EUR: 1 });
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
    const valid = balancesCapped.filter((b) => b.endBalance != null && (b.year < referenceDate.getFullYear() || (b.year === referenceDate.getFullYear() && b.month <= referenceDate.getMonth() + 1)));
    const latest = [...valid].sort((a, b) => (a.year - b.year) || (a.month - b.month)).pop();
    return latest?.endBalance ?? null;
  }, [balancesCapped]);

  // Investissements cotés : MONTANT INVESTI NET (achats - ventes, au coût d'acquisition
  // de ce qui reste détenu), à AUJOURD'HUI — comme sur /investments. PAS une valorisation
  // au cours du marché (plus fiable qu'un cours historique par ticker qui peut échouer
  // silencieusement), et PAS limité au mois précédent (contrairement au solde du compte,
  // on connaît le portefeuille exact à l'instant présent, pas seulement à la clôture d'un mois).
  const listedPortfolioValue = useMemo(() => {
    const byTicker = new Map<string, { buyQty: number; buyAmount: number; sellQty: number; currency: string }>();
    for (const t of transactions) {
      const cur = byTicker.get(t.ticker) ?? { buyQty: 0, buyAmount: 0, sellQty: 0, currency: t.currency ?? "EUR" };
      if (t.type === "vente") cur.sellQty += t.quantity;
      else { cur.buyQty += t.quantity; cur.buyAmount += t.amount; }
      byTicker.set(t.ticker, cur);
    }
    let total = 0;
    for (const { buyQty, buyAmount, sellQty, currency } of byTicker.values()) {
      const avgPrice = buyQty > 0 ? buyAmount / buyQty : 0;
      const remainingQty = Math.max(buyQty - sellQty, 0);
      total += avgPrice * remainingQty * (rates[currency] ?? 1);
    }
    return total;
  }, [transactions, rates]);

  // Investissements non cotés : dernière valorisation connue, à AUJOURD'HUI — comme
  // sur /investments (page "Investissements non cotés"), pas limité au mois précédent.
  const privateInvestedValue = useMemo(() => {
    return privateInvestments.filter((inv) => !inv.closedAt).reduce((s, inv) => {
      const last = [...(inv.valuations ?? [])].sort((a: any, b: any) => a.date.localeCompare(b.date)).pop();
      const value = last?.estimatedValue ?? inv.amountInvested;
      return s + value * (rates[inv.currency] ?? 1);
    }, 0);
  }, [privateInvestments, rates]);

  const portfolioValue = listedPortfolioValue + privateInvestedValue;

  // Solde restant dû des dettes, à AUJOURD'HUI (formule d'amortissement — comme /dettes),
  // pas limité au mois précédent non plus.
  const totalDebtRemaining = useMemo(() => {
    return debts.reduce((s, d) => {
      const prepaid = (d.prepayments ?? []).reduce((ps: number, p: any) => ps + p.amount, 0);
      const state = computeLoanState(d.amount, d.interestRatePct, d.durationMonths, d.monthlyPayment, new Date(d.startDate), prepaid);
      return s + state.remainingBalance;
    }, 0);
  }, [debts]);

  // Patrimoine NET = solde du compte (connu au dernier mois clos, on ne connaît pas le
  // solde exact d'aujourd'hui sans saisie) + portefeuille et dettes (calculés à l'instant
  // présent, à partir des transactions/mensualités — ces derniers n'ont pas cette limite).
  const totalWealth = (liquidBalance ?? 0) + portfolioValue - totalDebtRemaining;
  // "Ce que j'ai effectivement" (compte + investissements, SANS déduire les dettes) —
  // utilisé pour les objectifs, qui parlent d'actifs accumulés, pas de patrimoine net
  const grossAssets = (liquidBalance ?? 0) + portfolioValue;

  const avgMonthlySavings = useMemo(() => {
    if (monthTotals.length === 0) return 0;
    return monthTotals.reduce((s, t) => s + t.epargne, 0) / monthTotals.length;
  }, [monthTotals]);

  return {
    loading, entries, monthTotals, balancesCapped, transactions, privateInvestments, debts, rates,
    liquidBalance, listedPortfolioValue, privateInvestedValue, portfolioValue, totalDebtRemaining,
    totalWealth, grossAssets, avgMonthlySavings, referenceDate,
  };
}
