const CATEGORY_COLOR_PALETTE = [
  "#1D9E75",
  "#3b82f6",
  "#f59e0b",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#e05252",
  "#84cc16",
];

export function getCategoryColor(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!normalized) {
    return CATEGORY_COLOR_PALETTE[0];
  }

  const hash = normalized
    .split("")
    .reduce((accumulator, char) => accumulator + char.charCodeAt(0), 0);

  return CATEGORY_COLOR_PALETTE[hash % CATEGORY_COLOR_PALETTE.length];
}
