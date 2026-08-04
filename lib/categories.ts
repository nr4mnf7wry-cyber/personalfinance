// Source unique de vérité pour les groupes / catégories / sous-catégories.
// Modifiable librement — tout le reste de l'app (formulaire, dashboard, import Excel) s'appuie dessus.

import { GROUP_PALETTE } from "./theme";

export type Group = "revenus" | "fixes" | "variables" | "epargne";

export const GROUP_LABELS: Record<Group, string> = {
  revenus: "Revenus",
  fixes: "Dépenses fixes",
  variables: "Dépenses variables",
  epargne: "Épargne",
};

export const GROUP_COLORS: Record<Group, string> = GROUP_PALETTE;

export const CATEGORIES_HELP =
  "Les catégories sont désormais propres à chaque utilisateur : gérées via /api/categories, " +
  "créées à la main dans /input ou automatiquement lors d'un import Excel.";

export const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
