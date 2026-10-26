import { CATEGORIES } from "@/lib/categories";
import type { Field, Option, SectionDef, SectionKind } from "./types";

/* Every section type the admin can add. Shared by the admin (forms, picker) and the site (rendering). */

const heading = (hint?: string): Field => ({ name: "heading", label: "Heading", kind: "text", max: 140, hint });
const kicker: Field = { name: "kicker", label: "Small label above the heading", kind: "text", max: 60 };
const intro: Field = { name: "intro", label: "Text under the heading", kind: "textarea", max: 600, rows: 3 };
const button = (name = "button", label = "Button"): Field => ({ name, label, kind: "link", hint: "Leave the label empty to hide the button." });

export const FORM_TYPES: Option[] = [
  { value: "enquiry", label: "Enquiry" },
  { value: "sample", label: "Order free samples" },
  { value: "download", label: "Download a brochure" },
  { value: "dealer", label: "Become a dealer" },
  { value: "video_call", label: "Book a video call" },
  { value: "visit", label: "Book a studio visit" },
];

export const COLLECTION_OPTIONS: Option[] = CATEGORIES.map((c) => ({ value: c.slug, label: c.title }));

export const SECTIONS: SectionDef[] = [
  {
    type: "hero",
    label: "Hero",
    description: "The opening of the page: a large photo or video with the main heading and buttons.",
    group: "Intro",
    oncePerPage: true,
    usableIn: ["page"],
    fields: [
      { name: "style", label: "Layout", kind: "select", default: "full", options: [
        { value: "full", label: "Photo across the full width" },
        { value: "split", label: "Photo beside the text" },
        { value: "minimal", label: "Text only" },
      ] },
      kicker,
      { name: "heading", label: "Heading", kind: "text", max: 140, required: true, hint: "Becomes the page's main heading (H1)." },
      intro,
      { name: "image", label: "Photo", kind: "image" },
      { name: "video", label: "Background video (YouTube link, optional)", kind: "video", hint: "Plays silently behind the heading; the photo shows until it loads." },
      button("primary", "Main button"),
      button("secondary", "Second button"),
    ],
    sketch: [
      { x: 0, y: 0, w: 100, h: 60, tone: "fill" },
      { x: 8, y: 22, w: 46, h: 7, tone: "accent" },
      { x: 8, y: 33, w: 34, h: 3 },
      { x: 8, y: 42, w: 16, h: 6, tone: "line" },
    ],
  },
  {
    type: "text",
    label: "Text",
    description: "Headings, paragraphs, lists, links and tables, like a document.",
    group: "Content",
    fields: [
      kicker,
      heading(),
      { name: "body", label: "Text", kind: "richtext", required: true },
      { name: "width", label: "Width", kind: "select", default: "narrow", options: [
        { value: "narrow", label: "Reading width" },
        { value: "wide", label: "Wide" },
      ] },
    ],
    sketch: [
      { x: 25, y: 8, w: 40, h: 6, tone: "accent" },
      { x: 25, y: 20, w: 50, h: 3 },
      { x: 25, y: 27, w: 50, h: 3 },
      { x: 25, y: 34, w: 44, h: 3 },
      { x: 25, y: 41, w: 48, h: 3 },
    ],
  },
  {
    type: "mediaText",
    label: "Image and text",
    description: "A photo beside a heading, text and a button. Alternate sides down the page.",
    group: "Content",
    fields: [
      { name: "image", label: "Photo", kind: "image", required: true },
      { name: "side", label: "Photo side", kind: "select", default: "left", options: [
        { value: "left", label: "Photo on the left" },
        { value: "right", label: "Photo on the right" },
      ] },
      kicker,
      heading(),
      { name: "body", label: "Text", kind: "richtext" },
      button(),
    ],
    sketch: [
      { x: 4, y: 6, w: 44, h: 48, tone: "fill" },
      { x: 56, y: 16, w: 30, h: 6, tone: "accent" },
      { x: 56, y: 27, w: 38, h: 3 },
      { x: 56, y: 33, w: 34, h: 3 },
      { x: 56, y: 42, w: 14, h: 5, tone: "line" },
    ],
  },
  {
    type: "gallery",
    label: "Gallery",
    description: "Several photos as a grid or a slider, e.g. a finished project.",
    group: "Media",
    fields: [
      heading(),
      { name: "images", label: "Photos", kind: "images", required: true, max: 40 },
      { name: "style", label: "Layout", kind: "select", default: "grid", options: [
        { value: "grid", label: "Grid" },
        { value: "slider", label: "Slider" },
      ] },
      { name: "captions", label: "Show captions", kind: "toggle", default: false },
    ],
    sketch: [
      { x: 4, y: 8, w: 28, h: 22, tone: "fill" },
      { x: 36, y: 8, w: 28, h: 22, tone: "fill" },
      { x: 68, y: 8, w: 28, h: 22, tone: "fill" },
      { x: 4, y: 34, w: 28, h: 22, tone: "fill" },
      { x: 36, y: 34, w: 28, h: 22, tone: "fill" },
      { x: 68, y: 34, w: 28, h: 22, tone: "fill" },
    ],
  },
  {
    type: "productGrid",
    label: "Products",
    description: "Products from Twenty: one collection, the featured ones, or hand-picked. New products appear on their own.",
    group: "Products",
    fields: [
      kicker,
      heading(),
      intro,
      { name: "products", label: "Which products", kind: "products", required: true },
      { name: "style", label: "Layout", kind: "select", default: "grid", options: [
        { value: "grid", label: "Grid" },
        { value: "slider", label: "Slider" },
      ] },
      button("button", "Link under the products"),
    ],
    sketch: [
      { x: 4, y: 6, w: 30, h: 4, tone: "accent" },
      { x: 4, y: 16, w: 21, h: 28, tone: "fill" },
      { x: 28, y: 16, w: 21, h: 28, tone: "fill" },
      { x: 52, y: 16, w: 21, h: 28, tone: "fill" },
      { x: 76, y: 16, w: 21, h: 28, tone: "fill" },
      { x: 4, y: 48, w: 14, h: 3 },
      { x: 28, y: 48, w: 14, h: 3 },
    ],
  },
  {
    type: "collectionCards",
    label: "Collections",
    description: "Cards that link to the product collections (engineered wood, laminate, decking…).",
    group: "Products",
    fields: [
      kicker,
      heading(),
      { name: "collections", label: "Collections to show", kind: "items", itemLabel: "Collection", titleField: "collection", max: 6, fields: [
        { name: "collection", label: "Collection", kind: "select", options: COLLECTION_OPTIONS, required: true },
        { name: "image", label: "Photo (optional)", kind: "image" },
        { name: "text", label: "Short text (optional)", kind: "textarea", max: 200, rows: 2 },
      ] },
    ],
    sketch: [
      { x: 4, y: 8, w: 44, h: 22, tone: "fill" },
      { x: 52, y: 8, w: 44, h: 22, tone: "fill" },
      { x: 4, y: 34, w: 44, h: 22, tone: "fill" },
      { x: 52, y: 34, w: 44, h: 22, tone: "fill" },
    ],
  },
  {
    type: "cta",
    label: "Call to action",
    description: "A short banner asking visitors to do one thing, like order samples or book a visit.",
    group: "Action",
    fields: [
      heading(),
      intro,
      { name: "image", label: "Background photo (optional)", kind: "image" },
      button("primary", "Main button"),
      button("secondary", "Second button"),
    ],
    sketch: [
      { x: 4, y: 12, w: 92, h: 36, tone: "fill" },
      { x: 12, y: 22, w: 40, h: 6, tone: "accent" },
      { x: 12, y: 33, w: 18, h: 6, tone: "line" },
    ],
  },
  {
    type: "features",
    label: "Feature cards",
    description: "Three to six short points with an optional photo each, e.g. why choose Span Floors.",
    group: "Content",
    fields: [
      kicker,
      heading(),
      intro,
      { name: "items", label: "Cards", kind: "items", itemLabel: "Card", titleField: "title", min: 1, max: 12, fields: [
        { name: "image", label: "Photo (optional)", kind: "image" },
        { name: "title", label: "Title", kind: "text", max: 90, required: true },
        { name: "text", label: "Text", kind: "textarea", max: 400, rows: 3 },
        { name: "link", label: "Link (optional)", kind: "link" },
      ] },
    ],
    sketch: [
      { x: 4, y: 10, w: 28, h: 16, tone: "fill" },
      { x: 36, y: 10, w: 28, h: 16, tone: "fill" },
      { x: 68, y: 10, w: 28, h: 16, tone: "fill" },
      { x: 4, y: 30, w: 20, h: 4, tone: "accent" },
      { x: 36, y: 30, w: 20, h: 4, tone: "accent" },
      { x: 68, y: 30, w: 20, h: 4, tone: "accent" },
      { x: 4, y: 38, w: 26, h: 3 },
      { x: 36, y: 38, w: 26, h: 3 },
      { x: 68, y: 38, w: 26, h: 3 },
    ],
  },
  {
    type: "stats",
    label: "Big numbers",
    description: "A row of key figures, e.g. years in business, projects, cities.",
    group: "Trust",
    fields: [
      heading(),
      { name: "items", label: "Numbers", kind: "items", itemLabel: "Number", titleField: "value", min: 1, max: 6, fields: [
        { name: "value", label: "Number", kind: "text", max: 16, required: true, hint: "e.g. 2,500+ or 18" },
        { name: "label", label: "What it counts", kind: "text", max: 80, required: true },
      ] },
    ],
    sketch: [
      { x: 6, y: 18, w: 18, h: 10, tone: "accent" },
      { x: 30, y: 18, w: 18, h: 10, tone: "accent" },
      { x: 54, y: 18, w: 18, h: 10, tone: "accent" },
      { x: 78, y: 18, w: 18, h: 10, tone: "accent" },
      { x: 6, y: 32, w: 16, h: 3 },
      { x: 30, y: 32, w: 16, h: 3 },
      { x: 54, y: 32, w: 16, h: 3 },
      { x: 78, y: 32, w: 16, h: 3 },
    ],
  },
  {
    type: "faq",
    label: "Questions and answers",
    description: "Questions people ask, each with a short answer. Also sent to Google as FAQ data.",
    group: "Content",
    fields: [
      heading(),
      { name: "items", label: "Questions", kind: "items", itemLabel: "Question", titleField: "q", min: 1, max: 30, fields: [
        { name: "q", label: "Question", kind: "text", max: 200, required: true },
        { name: "a", label: "Answer", kind: "textarea", max: 1200, rows: 4, required: true, hint: "A complete answer in 40–80 words reads best in Google and AI answers." },
      ] },
    ],
    sketch: [
      { x: 20, y: 8, w: 30, h: 5, tone: "accent" },
      { x: 20, y: 20, w: 60, h: 6, tone: "line" },
      { x: 20, y: 30, w: 60, h: 6, tone: "line" },
      { x: 20, y: 40, w: 60, h: 6, tone: "line" },
    ],
  },
  {
    type: "testimonials",
    label: "Testimonials",
    description: "Quotes from clients, architects and designers.",
    group: "Trust",
    fields: [
      heading(),
      { name: "items", label: "Quotes", kind: "items", itemLabel: "Quote", titleField: "name", min: 1, max: 20, fields: [
        { name: "quote", label: "Quote", kind: "textarea", max: 600, rows: 3, required: true },
        { name: "name", label: "Name", kind: "text", max: 80, required: true },
        { name: "role", label: "Role or company", kind: "text", max: 120 },
        { name: "image", label: "Photo (optional)", kind: "image" },
      ] },
    ],
    sketch: [
      { x: 10, y: 14, w: 80, h: 4 },
      { x: 10, y: 22, w: 70, h: 4 },
      { x: 10, y: 36, w: 8, h: 8, tone: "fill" },
      { x: 22, y: 38, w: 20, h: 3, tone: "accent" },
    ],
  },
  {
    type: "logos",
    label: "Logos",
    description: "A row of logos: press features, awards or clients.",
    group: "Trust",
    fields: [
      heading(),
      { name: "items", label: "Logos", kind: "items", itemLabel: "Logo", titleField: "name", min: 1, max: 40, fields: [
        { name: "image", label: "Logo", kind: "image", required: true },
        { name: "name", label: "Name", kind: "text", max: 80, required: true, hint: "Used as the image's description." },
        { name: "href", label: "Link (optional)", kind: "text", max: 500 },
      ] },
    ],
    sketch: [
      { x: 4, y: 24, w: 16, h: 10, tone: "fill" },
      { x: 24, y: 24, w: 16, h: 10, tone: "fill" },
      { x: 44, y: 24, w: 16, h: 10, tone: "fill" },
      { x: 64, y: 24, w: 16, h: 10, tone: "fill" },
      { x: 84, y: 24, w: 12, h: 10, tone: "fill" },
    ],
  },
  {
    type: "video",
    label: "Video",
    description: "A YouTube or Vimeo video with an optional heading and caption. Also sent to Google as video data.",
    group: "Media",
    fields: [
      heading(),
      { name: "url", label: "Video link", kind: "video", required: true },
      { name: "title", label: "Video title (for Google)", kind: "text", max: 120 },
      { name: "caption", label: "Caption", kind: "textarea", max: 400, rows: 2 },
    ],
    sketch: [
      { x: 14, y: 6, w: 72, h: 46, tone: "fill" },
      { x: 45, y: 24, w: 10, h: 10, tone: "accent" },
    ],
  },
  {
    type: "downloads",
    label: "Downloads",
    description: "Brochures, catalogues and guides to download. Can ask for details first.",
    group: "Action",
    fields: [
      heading(),
      intro,
      { name: "gated", label: "Ask for name and phone before the download", kind: "toggle", default: false },
      { name: "items", label: "Files", kind: "items", itemLabel: "File", titleField: "title", min: 1, max: 20, fields: [
        { name: "title", label: "Title", kind: "text", max: 120, required: true },
        { name: "file", label: "File", kind: "file", required: true },
        { name: "image", label: "Cover (optional)", kind: "image" },
      ] },
    ],
    sketch: [
      { x: 4, y: 10, w: 20, h: 28, tone: "fill" },
      { x: 28, y: 10, w: 20, h: 28, tone: "fill" },
      { x: 52, y: 10, w: 20, h: 28, tone: "fill" },
      { x: 4, y: 42, w: 14, h: 4, tone: "accent" },
      { x: 28, y: 42, w: 14, h: 4, tone: "accent" },
      { x: 52, y: 42, w: 14, h: 4, tone: "accent" },
    ],
  },
  {
    type: "form",
    label: "Form",
    description: "One of the website forms: enquiry, free samples, dealer, video call or studio visit.",
    group: "Action",
    fields: [
      heading(),
      intro,
      { name: "formType", label: "Form", kind: "select", options: FORM_TYPES, default: "enquiry", required: true },
      { name: "image", label: "Photo beside the form (optional)", kind: "image" },
    ],
    sketch: [
      { x: 4, y: 8, w: 40, h: 44, tone: "fill" },
      { x: 52, y: 10, w: 44, h: 6, tone: "line" },
      { x: 52, y: 20, w: 44, h: 6, tone: "line" },
      { x: 52, y: 30, w: 44, h: 6, tone: "line" },
      { x: 52, y: 42, w: 18, h: 6, tone: "accent" },
    ],
  },
  {
    type: "studios",
    label: "Studios and map",
    description: "The experience studios with address, hours and directions, from Site settings.",
    group: "Action",
    fields: [
      heading(),
      intro,
      { name: "showMap", label: "Show a map", kind: "toggle", default: true },
    ],
    sketch: [
      { x: 4, y: 8, w: 56, h: 44, tone: "fill" },
      { x: 66, y: 10, w: 28, h: 4, tone: "accent" },
      { x: 66, y: 18, w: 26, h: 3 },
      { x: 66, y: 30, w: 28, h: 4, tone: "accent" },
      { x: 66, y: 38, w: 26, h: 3 },
    ],
  },
  {
    type: "listing",
    label: "Product list",
    description: "Marks where this page's own product list sits. Sections above it show above the products, the rest below.",
    group: "Products",
    oncePerPage: true,
    usableIn: ["system"],
    fields: [],
    sketch: [
      { x: 4, y: 4, w: 92, h: 6, tone: "line" },
      { x: 4, y: 14, w: 21, h: 20, tone: "fill" },
      { x: 28, y: 14, w: 21, h: 20, tone: "fill" },
      { x: 52, y: 14, w: 21, h: 20, tone: "fill" },
      { x: 76, y: 14, w: 21, h: 20, tone: "fill" },
      { x: 4, y: 38, w: 21, h: 20, tone: "fill" },
      { x: 28, y: 38, w: 21, h: 20, tone: "fill" },
    ],
  },
  {
    type: "pending",
    label: "Content coming soon",
    description: "Marks a part of the page still waiting for content. Visitors see a short note, or nothing.",
    group: "Other",
    fields: [
      { name: "note", label: "What is missing (admin only)", kind: "textarea", max: 400, rows: 2, required: true },
      { name: "public", label: "Show a 'coming soon' note to visitors", kind: "toggle", default: false },
      { name: "message", label: "Note for visitors", kind: "text", max: 160 },
    ],
    sketch: [{ x: 10, y: 14, w: 80, h: 32, tone: "line" }],
  },
  {
    type: "reusable",
    label: "Reusable section",
    description: "A section saved once and used on many pages. Change it once and every page updates.",
    group: "Other",
    fields: [{ name: "ref", label: "Reusable section", kind: "reusable", required: true }],
    sketch: [
      { x: 6, y: 10, w: 88, h: 40, tone: "line" },
      { x: 14, y: 22, w: 30, h: 6, tone: "accent" },
    ],
  },
];

const BY_TYPE = new Map(SECTIONS.map((s) => [s.type, s]));

export function sectionDef(type: string): SectionDef | undefined {
  return BY_TYPE.get(type);
}

/** Section types offered for a page, the extra sections of a blog post, or a fixed site page (page sections too). */
export function sectionsFor(kind: SectionKind) {
  return SECTIONS.filter((s) => !s.usableIn || s.usableIn.includes(kind) || (kind === "system" && s.usableIn.includes("page")));
}

/** Starting values for a new section of this type. */
export function emptyData(def: SectionDef): Record<string, unknown> {
  return Object.fromEntries(def.fields.map((f) => [f.name, emptyValue(f)]));
}

export function emptyValue(f: Field): unknown {
  switch (f.kind) {
    case "select":
      return f.default ?? f.options[0]?.value ?? "";
    case "toggle":
      return f.default ?? false;
    case "number":
      return f.default ?? null;
    case "images":
    case "items":
      return [];
    case "link":
      return { label: "", href: "" };
    case "products":
      return { mode: "collection", collection: COLLECTION_OPTIONS[0]?.value, limit: 8 };
    case "image":
    case "file":
    case "reusable":
      return null;
    default:
      return "";
  }
}
