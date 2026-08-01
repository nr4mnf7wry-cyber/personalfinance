import type { CategoryGroupKey } from "@/lib/categories";

export type EntryDTO = {
  id: string;
  year: number;
  month: number;
  group: CategoryGroupKey;
  categoryId: string;
  categoryName: string;
  amount: number;
  note?: string | null;
};

export type CategoryDTO = {
  id: string;
  group: CategoryGroupKey;
  name: string;
  order: number;
  archived: boolean;
};

export type MonthSummaryDTO = {
  year: number;
  month: number;
  startingBalance: number;
  totalIncome: number;
  totalFixed: number;
  totalVariable: number;
  totalSavings: number;
  totalExpenses: number;
  endingBalance: number;
  savingsRate: number | null;
};

export type InvestmentTxDTO = {
  id: string;
  ticker: string;
  name?: string | null;
  type: "BUY" | "SELL";
  quantity: number;
  pricePerUnit: number;
  fees: number;
  currency: string;
  date: string;
  note?: string | null;
  linkedEntryId?: string | null;
};

export type QuoteDTO = {
  ticker: string;
  price: number;
  currency: string;
  asOf: string;
  source: "alphavantage" | "finnhub" | "unavailable";
};

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
    };
  }
}
