/* Shared by server and client components. */

const ENUM_LABELS: Record<string, string> = {
  EARTHY_BROWN_TONES: "Earthy Brown",
  MEDIUM_BROWN_TONES: "Medium Brown",
  MEDIUM_NATURAL_TONES: "Medium Natural",
  AIRY_LIGHT_TONES: "Airy Light",
  WHITE_GREY_AND_BLACK_TONES: "White, Grey & Black",
  T_G_CLICK: "T&G / Click",
  T_G: "Tongue & Groove",
  CLICK: "Click",
  OPT5G_COSLOC: "5G Cosloc",
  OPT4_SIDE_GROOVE: "4-Side Groove",
  OPT3_LAYERED_SOFTWOOD: "3-Layer Softwood",
  OPT3_LAYERED_HARDWOOD: "3-Layer Hardwood",
  MULTI_LAYERED: "Multi-Layered",
  MULTI_LAYERED_BIRCH_EUCALYPTUS: "Multi-Layered Birch/Eucalyptus",
  MULTI_LAYERED_EUCALYPTUS: "Multi-Layered Eucalyptus",
  MULTI_LAYERED_BIRCH: "Multi-Layered Birch",
  MULTI_LAYERED_FULL_BIRCH: "Multi-Layered Full Birch",
  OPT1_COMMON: "Common",
  OPT1_NATUR: "Natur",
  SELECT_BETTER: "Select & Better",
  COMPOSED_CUT: "Composed Cut",
  SELECT_CUT: "Select Cut",
  NATURAL_CUT: "Natural Cut",
};

export function label(value: string | null | undefined): string {
  if (!value) return "";
  if (ENUM_LABELS[value]) return ENUM_LABELS[value];
  if (/^[A-Z]{1,4}$/.test(value)) return value; // grades like AB, ABC
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Tone swatch colours, used for placeholders and tone filters. */
export const TONE_COLORS: Record<string, string> = {
  EARTHY_BROWN_TONES: "#5b4330",
  MEDIUM_BROWN_TONES: "#8a6a4a",
  MEDIUM_NATURAL_TONES: "#a8875f",
  AIRY_LIGHT_TONES: "#cdb795",
  WHITE_GREY_AND_BLACK_TONES: "#8d8a84",
};

