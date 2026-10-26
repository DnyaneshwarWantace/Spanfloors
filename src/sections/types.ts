/**
 * Page sections: the building blocks of every page. One definition per section type (registry.ts) drives
 * the admin form, the server-side checks and the site rendering, so a new section type is one entry there
 * plus one component in components/.
 */

export type Option = { value: string; label: string };

type Base = {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
};

export type Field =
  | (Base & { kind: "text"; max?: number; placeholder?: string })
  | (Base & { kind: "textarea"; max?: number; rows?: number })
  | (Base & { kind: "richtext" })
  | (Base & { kind: "image" })
  | (Base & { kind: "images"; max?: number })
  /** Any media file (brochures, PDFs). */
  | (Base & { kind: "file" })
  | (Base & { kind: "link" })
  | (Base & { kind: "select"; options: Option[]; default?: string })
  | (Base & { kind: "toggle"; default?: boolean })
  | (Base & { kind: "number"; min?: number; max?: number; default?: number })
  | (Base & { kind: "video" })
  | (Base & { kind: "products" })
  | (Base & { kind: "reusable" })
  | (Base & { kind: "items"; fields: Field[]; min?: number; max?: number; itemLabel: string; titleField?: string });

export type FieldKind = Field["kind"];

/** Value shapes stored for each field kind. */
export type LinkValue = { label: string; href: string };
export type ProductsValue = {
  /** collection: one collection in its arranged order · featured: products marked featured · pick: hand-picked. */
  mode: "collection" | "featured" | "pick";
  collection?: string;
  ids?: string[];
  limit?: number;
};

export type SectionTheme = "default" | "muted" | "dark";
export type SectionSpacing = "compact" | "normal" | "spacious";

/** One section as stored in content.layout. */
export type Section = {
  id: string;
  type: string;
  /** Kept on the page but not shown to visitors. */
  hidden?: boolean;
  /** Admin-only label, e.g. "Spring offer banner". */
  name?: string;
  /** Optional #anchor for in-page links. */
  anchor?: string;
  theme?: SectionTheme;
  spacing?: SectionSpacing;
  data: Record<string, unknown>;
};

export type SectionGroup = "Intro" | "Content" | "Products" | "Media" | "Trust" | "Action" | "Other";

export type SectionDef = {
  type: string;
  label: string;
  /** One line on what the section is for (shown in the add-section picker). */
  description: string;
  group: SectionGroup;
  fields: Field[];
  /** Sections that only make sense once per page (e.g. a hero). */
  oncePerPage?: boolean;
  /** Where it can be used: pages, posts (extra sections after the article), fixed site pages (home, collections). */
  usableIn?: ("page" | "post" | "system")[];
  /** Simple line drawing for the picker: a list of boxes on a 100 × 60 grid. */
  sketch: { x: number; y: number; w: number; h: number; tone?: "line" | "fill" | "accent" }[];
};

/** Where sections are edited: a normal page, the extra sections of a post, or a fixed site page. */
export type SectionKind = "page" | "post" | "system";
