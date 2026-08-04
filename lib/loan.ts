export type LoanState = {
  monthsElapsed: number;
  monthsRemaining: number;
  totalInterest: number;   // intérêts totaux sur toute la durée (théorique)
  totalPaid: number;       // mensualité x durée
  remainingBalance: number; // solde restant dû aujourd'hui (théorique)
  payoffDate: Date;        // date du dernier paiement théorique
  progressPct: number;     // % du prêt remboursé (en durée)
};

export function computeLoanState(
  amount: number,
  interestRatePct: number,
  durationMonths: number,
  monthlyPayment: number,
  startDate: Date
): LoanState {
  const now = new Date();
  const monthsElapsedRaw =
    (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
  const monthsElapsed = Math.min(Math.max(monthsElapsedRaw, 0), durationMonths);
  const monthsRemaining = durationMonths - monthsElapsed;

  const totalPaid = monthlyPayment * durationMonths;
  const totalInterest = totalPaid - amount;

  const monthlyRate = interestRatePct / 100 / 12;
  let remainingBalance: number;
  if (monthlyRate === 0) {
    remainingBalance = amount - monthlyPayment * monthsElapsed;
  } else {
    const factor = Math.pow(1 + monthlyRate, monthsElapsed);
    remainingBalance = amount * factor - monthlyPayment * ((factor - 1) / monthlyRate);
  }
  remainingBalance = Math.max(remainingBalance, 0);

  const payoffDate = new Date(startDate.getFullYear(), startDate.getMonth() + durationMonths - 1, 1);
  const progressPct = durationMonths > 0 ? (monthsElapsed / durationMonths) * 100 : 0;

  return { monthsElapsed, monthsRemaining, totalInterest, totalPaid, remainingBalance, payoffDate, progressPct };
}

// Date de fin théorique du prêt (utilisée comme expiresAt de la catégorie liée)
export function computeLoanEndDate(startDate: Date, durationMonths: number): Date {
  return new Date(startDate.getFullYear(), startDate.getMonth() + durationMonths - 1, 1);
}

export const DEBT_TYPE_LABELS: Record<string, string> = {
  car: "Voiture",
  house: "Maison",
  personal: "Prêt personnel",
  real_estate_investment: "Investissement immobilier",
  other: "Autre",
};
