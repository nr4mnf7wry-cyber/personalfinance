// Source unique de vérité pour les groupes / catégories / sous-catégories.
// Modifiable librement — tout le reste de l'app (formulaire, dashboard, import Excel) s'appuie dessus.

export type Group = "revenus" | "fixes" | "variables" | "epargne";

export const GROUP_LABELS: Record<Group, string> = {
  revenus: "Revenus",
  fixes: "Dépenses fixes",
  variables: "Dépenses variables",
  epargne: "Épargne",
};

export const GROUP_COLORS: Record<Group, string> = {
  revenus: "#2f9e44",
  fixes: "#1971c2",
  variables: "#e8590c",
  epargne: "#7048e8",
};

export const CATEGORIES: Record<Group, { category: string; subCategories?: string[] }[]> = {
  revenus: [
    { category: "Salaire" },
    { category: "Freelance / à côté" },
    { category: "Autres revenus" },
  ],
  fixes: [
    { category: "Loyer / Crédit" },
    { category: "Assurances" },
    { category: "Abonnements" },
    { category: "Téléphone / Internet" },
    { category: "Transport" },
  ],
  variables: [
    { category: "Alimentation" },
    { category: "Sorties / Loisirs" },
    { category: "Shopping" },
    { category: "Santé" },
    { category: "Divers" },
  ],
  epargne: [
    { category: "Épargne de précaution" },
    { category: "Investissement" }, // catégorie spéciale, liée aux transactions boursières
  ],
};

export const ALL_CATEGORIES = Object.entries(CATEGORIES).flatMap(([group, cats]) =>
  cats.map((c) => ({ group: group as Group, ...c }))
);

export const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
