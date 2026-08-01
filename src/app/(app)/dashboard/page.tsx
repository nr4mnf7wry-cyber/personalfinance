"use client";

import { useEffect, useMemo, useState } from "react";
import MonthPicker from "@/components/input/MonthPicker";
import StatTile from "@/components/ui/StatTile";
import MonthDonutChart from "@/components/dashboard/MonthDonutChart";
import MonthlyBarChart from "@/components/dashboard/MonthlyBarChart";
import TopExpensesList from "@/components/dashboard/TopExpensesList";
import BalanceEvolutionChart from "@/components/dashboard/BalanceEvolutionChart";
import FlowsAreaChart from "@/components/dashboard/FlowsAreaChart";
import SavingsRateChart from "@/components/dashboard/SavingsRateChart";
import FixedVariableBarChart from "@/components/dashboard/FixedVariableBarChart";
import YearlyBarChart from "@/components/dashboard/YearlyBarChart";
import YoYPanel, { type CategoryChange } from "@/components/dashboard/YoYPanel";
import InvestmentsWidget from "@/components/dashboard/InvestmentsWidget";
import { formatAmount } from "@/components/ui/AmountText";
import { pctChange } from "@/lib/calculations";
import type { MonthSummaryDTO } from "@/types";

type DashboardData = {
  currency: string;
  month: MonthSummaryDTO;
  prevMonth: MonthSummaryDTO | null;
  monthCategoryBreakdown: { group: string; categoryId: string; categoryName: string; amount: number }[];
  timeSeries: MonthSummaryDTO[];
  yearly: {
    year: number;
    totalIncome: number;
    totalFixed: number;
    totalVariable: number;
    totalSavings: number;
    totalExpenses: number;
  }[];
  yoy: {
    hasPreviousYear: boolean;
    currentMonth: MonthSummaryDTO;
    previousYearMonth: MonthSummaryDTO | null;
    categoryChanges: CategoryChange[];
    ytdCurrent: { totalIncome: number; totalExpenses: number; totalSavings: number } | null;
    ytdPrevious: { totalIncome: number; totalExpenses: number; totalSavings: number } | null;
  };
};

export default function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [year, month]);

  const incomeDelta = useMemo(() => {
    if (!data?.prevMonth) return null;
    return pctChange(data.month.totalIncome, data.prevMonth.totalIncome);
  }, [data]);
  const expenseDelta = useMemo(() => {
    if (!data?.prevMonth) return null;
    return pctChange(data.month.totalExpenses, data.prevMonth.totalExpenses);
  }, [data]);

  if (loading || !data) {
    return <p className="text-sm text-slate-400">Chargement du dashboard...</p>;
  }

  const { currency } = data;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Solde net actuel" value={formatAmount(data.month.endingBalance, currency)} />
        <StatTile
          label="Taux d'épargne"
          value={data.month.savingsRate !== null ? `${data.month.savingsRate.toFixed(0)}%` : "—"}
        />
        <StatTile
          label="Revenus vs mois préc."
          value={formatAmount(data.month.totalIncome, currency)}
          delta={incomeDelta}
          positiveIsGood
        />
        <StatTile
          label="Dépenses vs mois préc."
          value={formatAmount(data.month.totalExpenses, currency)}
          delta={expenseDelta}
          positiveIsGood={false}
        />
      </div>

      {/* A. Vue mensuelle */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Vue mensuelle
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card lg:col-span-1">
            <h3 className="mb-2 text-sm font-medium">Répartition des dépenses</h3>
            <MonthDonutChart data={data.monthCategoryBreakdown} currency={currency} />
          </div>
          <div className="card lg:col-span-1">
            <h3 className="mb-2 text-sm font-medium">Revenus / Dépenses / Épargne</h3>
            <MonthlyBarChart summary={data.month} currency={currency} />
          </div>
          <div className="card lg:col-span-1">
            <h3 className="mb-2 text-sm font-medium">Top 5 dépenses</h3>
            <TopExpensesList data={data.monthCategoryBreakdown} />
          </div>
        </div>
      </section>

      {/* B. Évolution dans le temps */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Évolution dans le temps
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h3 className="mb-2 text-sm font-medium">Solde net (patrimoine)</h3>
            <BalanceEvolutionChart series={data.timeSeries} currency={currency} />
          </div>
          <div className="card">
            <h3 className="mb-2 text-sm font-medium">Revenus / Dépenses / Épargne</h3>
            <FlowsAreaChart series={data.timeSeries} currency={currency} />
          </div>
          <div className="card">
            <h3 className="mb-2 text-sm font-medium">Taux d&apos;épargne (moyenne 3 mois)</h3>
            <SavingsRateChart series={data.timeSeries} />
          </div>
          <div className="card">
            <h3 className="mb-2 text-sm font-medium">Dépenses fixes vs variables</h3>
            <FixedVariableBarChart series={data.timeSeries} currency={currency} />
          </div>
        </div>
      </section>

      {/* C. Vue annuelle */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Vue annuelle
        </h2>
        <div className="card">
          <YearlyBarChart data={data.yearly} currency={currency} />
        </div>
      </section>

      {/* D. YoY */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Comparaison année sur année (YoY)
        </h2>
        <div className="card">
          {!data.yoy.hasPreviousYear ? (
            <p className="text-sm text-slate-400">
              Pas encore de données sur la même période l&apos;an dernier pour comparer.
            </p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile
                  label="Revenus (mois)"
                  value={formatAmount(data.yoy.currentMonth.totalIncome, currency)}
                  delta={pctChange(
                    data.yoy.currentMonth.totalIncome,
                    data.yoy.previousYearMonth?.totalIncome ?? 0
                  )}
                  deltaLabel="vs l'an dernier"
                />
                <StatTile
                  label="Dépenses (mois)"
                  value={formatAmount(data.yoy.currentMonth.totalExpenses, currency)}
                  delta={pctChange(
                    data.yoy.currentMonth.totalExpenses,
                    data.yoy.previousYearMonth?.totalExpenses ?? 0
                  )}
                  deltaLabel="vs l'an dernier"
                  positiveIsGood={false}
                />
                {data.yoy.ytdCurrent && data.yoy.ytdPrevious && (
                  <>
                    <StatTile
                      label="Cumul revenus (YTD)"
                      value={formatAmount(data.yoy.ytdCurrent.totalIncome, currency)}
                      delta={pctChange(data.yoy.ytdCurrent.totalIncome, data.yoy.ytdPrevious.totalIncome)}
                      deltaLabel="YTD vs YTD"
                    />
                    <StatTile
                      label="Cumul épargne (YTD)"
                      value={formatAmount(data.yoy.ytdCurrent.totalSavings, currency)}
                      delta={pctChange(data.yoy.ytdCurrent.totalSavings, data.yoy.ytdPrevious.totalSavings)}
                      deltaLabel="YTD vs YTD"
                    />
                  </>
                )}
              </div>
              <YoYPanel changes={data.yoy.categoryChanges} currency={currency} />
            </>
          )}
        </div>
      </section>

      {/* E. Investissements */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Investissements
        </h2>
        <InvestmentsWidget />
      </section>
    </div>
  );
}
