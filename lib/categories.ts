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
    { category: "Salary" },
    { category: "Coaching" },
    { category: "Referee" },
    { category: "Other income" },
  ],
  fixes: [
    { category: "Rent" },
    { category: "Electricity" },
    { category: "Gas" },
    { category: "Water" },
    { category: "Internet" },
    { category: "Gym" },
    { category: "Netflix" },
    { category: "Phone" },
    { category: "Music" },
    { category: "Mutual" },
    { category: "Car payment" },
    { category: "Car insurance" },
    { category: "Parking" },
    { category: "Creche" },
  ],
  variables: [
    { category: "Food" },
    { category: "Car fuel" },
    { category: "Clothes" },
    { category: "Other expenses" },
  ],
  epargne: [
    { category: "Reserve build" },
    { category: "Investment" }, // catégorie spéciale, liée aux transactions boursières
  ],
};

export const ALL_CATEGORIES = Object.entries(CATEGORIES).flatMap(([group, cats]) =>
  cats.map((c) => ({ group: group as Group, ...c }))
);

export const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
