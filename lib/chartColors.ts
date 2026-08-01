// Shared categorical palette for charts across the dashboard — kept distinct
// from pure hue rotation so adjacent categories stay visually separable in
// both light and dark mode, and colorblind-safe-ish (varying lightness too).
export const CATEGORY_PALETTE = [
  "#3563e9", // brand blue
  "#2f9e6b", // green
  "#e0a12b", // amber
  "#d1495b", // red
  "#8e5bd6", // purple
  "#1c9099", // teal
  "#e0708c", // pink
  "#6b7fd7", // periwinkle
  "#c98a3c", // ochre
  "#4f8a3d", // olive green
  "#9c6644", // brown
  "#5b6b8c", // slate blue
];

export function colorForIndex(i: number) {
  return CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
}

export const SEMANTIC_COLORS = {
  income: "#2f9e6b",
  fixed: "#d1495b",
  variable: "#e0a12b",
  savings: "#3563e9",
  expense: "#d1495b",
  balance: "#3563e9",
};
