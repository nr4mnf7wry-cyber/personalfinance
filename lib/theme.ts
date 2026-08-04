// Palette centralisée — s'inspire des codes visuels de la gestion de patrimoine :
// encre marine profonde, accent or discret, verts/rouges sobres (jamais criards).
// Toute couleur utilisée dans un graphique ou un composant doit venir d'ici,
// pour garantir une identité visuelle cohérente sur tout le dashboard.

export const INK = "#12233F";      // texte fort, éléments structurants
export const SLATE = "#5B6B82";    // texte secondaire
export const GOLD = "#A8823C";     // accent signature (remplace le bleu générique)
export const POSITIVE = "#2F6F52"; // vert sobre — gains, positif
export const NEGATIVE = "#9B3B3B"; // rouge brique — pertes, négatif

// Palette catégorielle (graphiques à plusieurs séries : donut de dépenses, etc.)
// 8 teintes choisies pour rester harmonieuses ensemble plutôt que criardes.
export const CATEGORICAL_PALETTE = [
  "#12233F", // encre
  "#A8823C", // or
  "#5B7B8C", // bleu-gris
  "#7A6B8C", // prune discret
  "#6B8F71", // sauge
  "#B0715A", // terracotta doux
  "#8C7A5B", // taupe
  "#4A6670", // pétrole
];

// Palette dédiée patrimoine (liquidités vs investissements)
export const WEALTH_PALETTE = [INK, GOLD];

// Couleurs des 4 groupes budgétaires — remplace les couleurs vives d'origine
export const GROUP_PALETTE = {
  revenus: POSITIVE,
  fixes: INK,
  variables: GOLD,
  epargne: "#5B7B8C",
};
