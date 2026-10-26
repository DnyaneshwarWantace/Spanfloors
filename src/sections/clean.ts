import "server-only";
import { randomUUID } from "node:crypto";
import { sanitizeBody, slugify } from "@/server/html";
import { COLLECTION_OPTIONS, sectionDef } from "./registry";
import type { Field, Section, SectionKind, SectionSpacing, SectionTheme } from "./types";
import { parseVideo } from "./video";

/**
 * Checks and cleans page sections sent from the admin before they are saved. Nothing from the browser is
 * trusted: unknown section types and fields are dropped, text is trimmed to its limit, rich text is sanitised
 * like page bodies, links must be site paths or http(s)/mailto/tel, and media references must look like ids.
 * Missing required fields are reported (so publishing can be blocked) but the rest of the page still saves.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECTION_ID = /^[A-Za-z0-9_-]{6,40}$/;
const THEMES: SectionTheme[] = ["default", "muted", "dark"];
const SPACINGS: SectionSpacing[] = ["compact", "normal", "spacious"];
export const MAX_SECTIONS = 60;

export type CleanResult = { sections: Section[]; problems: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");

/** Site path, in-page anchor, http(s), mailto or tel. Anything else (javascript:, data:, //host) is dropped. */
export function safeHref(v: unknown): string {
  const h = str(v, 1000);
  if (!h) return "";
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (h.startsWith("#")) return h;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(h)) {
    try {
      if (/^https?:/i.test(h)) new URL(h);
      return h;
    } catch {
      return "";
    }
  }
  return "";
}

function cleanValue(f: Field, raw: unknown): unknown {
  switch (f.kind) {
    case "text":
      return str(raw, f.max ?? 300);
    case "textarea":
      return str(raw, f.max ?? 2000);
    case "richtext":
      return typeof raw === "string" ? sanitizeBody(raw).slice(0, 100_000) : "";
    case "image":
    case "file":
    case "reusable":
      return typeof raw === "string" && UUID.test(raw) ? raw : null;
    case "images":
      return Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === "string" && UUID.test(x)))].slice(0, f.max ?? 60) : [];
    case "link": {
      const o = isObj(raw) ? raw : {};
      return { label: str(o.label, 80), href: safeHref(o.href) };
    }
    case "select": {
      const v = typeof raw === "string" ? raw : "";
      return f.options.some((o) => o.value === v) ? v : (f.default ?? f.options[0]?.value ?? "");
    }
    case "toggle":
      return raw === true || raw === "true" || raw === "on";
    case "number": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n) || raw === "" || raw == null) return f.default ?? null;
      return Math.min(f.max ?? Infinity, Math.max(f.min ?? -Infinity, n));
    }
    case "video":
      return parseVideo(raw)?.url ?? "";
    case "products": {
      const o = isObj(raw) ? raw : {};
      const mode = o.mode === "featured" || o.mode === "pick" ? o.mode : "collection";
      const collection = COLLECTION_OPTIONS.some((c) => c.value === o.collection) ? (o.collection as string) : COLLECTION_OPTIONS[0]?.value;
      const ids = Array.isArray(o.ids) ? [...new Set(o.ids.filter((x): x is string => typeof x === "string" && UUID.test(x)))].slice(0, 48) : [];
      const limit = Math.min(48, Math.max(1, Math.round(Number(o.limit) || 8)));
      return { mode, collection, ids, limit };
    }
    case "items": {
      if (!Array.isArray(raw)) return [];
      return raw
        .filter(isObj)
        .slice(0, f.max ?? 50)
        .map((item) => ({
          id: typeof item.id === "string" && SECTION_ID.test(item.id) ? item.id : randomUUID(),
          ...Object.fromEntries(f.fields.map((sub) => [sub.name, cleanValue(sub, item[sub.name])])),
        }));
    }
  }
}

function isEmpty(f: Field, v: unknown) {
  if (v == null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (f.kind === "link") return !(v as { href: string }).href;
  if (f.kind === "products") {
    const p = v as { mode: string; ids: string[] };
    return p.mode === "pick" && p.ids.length === 0;
  }
  return false;
}

function missing(fields: Field[], data: Record<string, unknown>, where: string, problems: string[]) {
  for (const f of fields) {
    const v = data[f.name];
    if (f.required && isEmpty(f, v)) problems.push(`${where}: “${f.label}” is empty.`);
    if (f.kind === "items" && Array.isArray(v)) {
      if (f.min && v.length < f.min) problems.push(`${where}: add at least ${f.min} ${f.itemLabel.toLowerCase()}${f.min > 1 ? "s" : ""}.`);
      v.forEach((item, i) => missing(f.fields, item as Record<string, unknown>, `${where}, ${f.itemLabel.toLowerCase()} ${i + 1}`, problems));
    }
  }
}

/** Cleans a layout for a page or a post. `raw` is the parsed JSON from the admin form. */
export function cleanSections(raw: unknown, kind: SectionKind): CleanResult {
  const problems: string[] = [];
  if (!Array.isArray(raw)) return { sections: [], problems: raw == null ? [] : ["The page sections could not be read. Reload the page and try again."] };
  if (raw.length > MAX_SECTIONS) problems.push(`A page can have up to ${MAX_SECTIONS} sections; the extra ones were left out.`);

  const sections: Section[] = [];
  const seenIds = new Set<string>();
  const once = new Set<string>();
  for (const s of raw.slice(0, MAX_SECTIONS)) {
    if (!isObj(s) || typeof s.type !== "string") continue;
    const def = sectionDef(s.type);
    if (!def || (def.usableIn && !def.usableIn.includes(kind) && !(kind === "system" && def.usableIn.includes("page")))) {
      problems.push(`A “${s.type}” section can't be used here and was left out.`);
      continue;
    }
    let id = typeof s.id === "string" && SECTION_ID.test(s.id) ? s.id : randomUUID();
    if (seenIds.has(id)) id = randomUUID();
    seenIds.add(id);
    const data = isObj(s.data) ? s.data : {};
    const section: Section = {
      id,
      type: def.type,
      data: Object.fromEntries(def.fields.map((f) => [f.name, cleanValue(f, data[f.name])])),
    };
    if (s.hidden === true) section.hidden = true;
    const name = str(s.name, 80);
    if (name) section.name = name;
    const anchor = slugify(str(s.anchor, 60)).replace(/\//g, "-");
    if (anchor) section.anchor = anchor;
    if (THEMES.includes(s.theme as SectionTheme) && s.theme !== "default") section.theme = s.theme as SectionTheme;
    if (SPACINGS.includes(s.spacing as SectionSpacing) && s.spacing !== "normal") section.spacing = s.spacing as SectionSpacing;

    const where = `Section ${sections.length + 1} (${name || def.label})`;
    if (!section.hidden) {
      missing(def.fields, section.data, where, problems);
      if (def.oncePerPage) {
        if (once.has(def.type)) problems.push(`${where}: a page should have only one ${def.label.toLowerCase()}.`);
        once.add(def.type);
      }
    }
    sections.push(section);
  }
  return { sections, problems };
}
