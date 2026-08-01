// Default categories, seeded once per user and fully editable afterwards
// from /settings. Matches Kevin's existing Excel structure (2024+).
export const DEFAULT_CATEGORIES = {
  income: ["Salaire", "Coaching", "Arbitrage", "Autre"],
  fixed: [
    "Loyer",
    "Électricité",
    "Gaz",
    "Eau",
    "Internet",
    "Gym",
    "Netflix",
    "Téléphone",
    "Musique",
    "Mutuelle",
    "Remboursement voiture",
    "Assurance voiture",
    "Parking",
    "Crèche",
  ],
  variable: ["Nourriture", "Carburant", "Vêtements", "Autre"],
  savings: ["Constitution de réserve", "Investissement"],
} as const;

export type CategoryGroupKey = keyof typeof DEFAULT_CATEGORIES;

export const GROUP_LABELS: Record<CategoryGroupKey, string> = {
  income: "Revenus",
  fixed: "Dépenses fixes",
  variable: "Dépenses variables",
  savings: "Épargne",
};

export const GROUP_ORDER: CategoryGroupKey[] = [
  "income",
  "fixed",
  "variable",
  "savings",
];

// Name of the savings category whose entries auto-link to the investments
// page (see /input "lien investissements").
export const INVESTMENT_CATEGORY_NAME = "Investissement";

export const MONTH_LABELS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export const MONTH_LABELS_SHORT_FR = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Jun",
  "Jul",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];
