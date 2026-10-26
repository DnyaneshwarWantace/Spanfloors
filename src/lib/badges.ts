/* Product badges (shared by admin and site). */
export const BADGES = [
  { key: "new", label: "New" },
  { key: "bestseller", label: "Bestseller" },
  { key: "limited", label: "Limited stock" },
  { key: "eco", label: "Sustainable" },
] as const;

export type BadgeKey = (typeof BADGES)[number]["key"];

export const badgeLabel = (key: string) => BADGES.find((b) => b.key === key)?.label ?? null;
