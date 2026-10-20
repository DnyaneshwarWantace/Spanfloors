import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/* ---------- Users & sessions ---------- */

export const roleEnum = pgEnum("role", ["admin", "editor"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("editor"),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the random token stored in the cookie (the raw token is never stored). */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    ip: text("ip"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ---------- Media ---------- */

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Path inside the storage root, e.g. "2026/10/oak-floor.jpg". Served at /media/<path>. */
    path: text("path").notNull().unique(),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt").notNull().default(""),
    caption: text("caption").notNull().default(""),
    /** Original URL on the WordPress site (for imported files and URL rewriting). */
    legacyUrl: text("legacy_url").unique(),
    legacyWpId: integer("legacy_wp_id").unique(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("media_created_idx").on(t.createdAt)],
);

/* ---------- Content: blog posts & pages ---------- */

export const contentTypeEnum = pgEnum("content_type", ["post", "page"]);
export const contentStatusEnum = pgEnum("content_status", ["draft", "published", "scheduled", "archived"]);

export const content = pgTable(
  "content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: contentTypeEnum("type").notNull(),
    /** Full public path with trailing slash, e.g. "/wooden-flooring-101-guide/". Unique across the site. */
    path: text("path").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    /** Sanitised HTML body (rich-text editor output, or cleaned HTML imported from WordPress). */
    body: text("body").notNull().default(""),
    featuredMediaId: uuid("featured_media_id").references(() => media.id, { onDelete: "set null" }),
    status: contentStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    /** e.g. "max-image-preview:large" or "noindex, nofollow". */
    robots: text("robots"),
    canonicalUrl: text("canonical_url"),
    ogImageMediaId: uuid("og_image_media_id").references(() => media.id, { onDelete: "set null" }),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    legacyWpId: integer("legacy_wp_id"),
    legacyWpType: text("legacy_wp_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("content_path_idx").on(t.path),
    index("content_type_status_idx").on(t.type, t.status, t.publishedAt),
    uniqueIndex("content_legacy_idx").on(t.legacyWpType, t.legacyWpId),
  ],
);

/* ---------- Settings (site settings, menus, integrations & API keys) ---------- */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  /** Plain JSON value, or for secrets an AES-256-GCM ciphertext string. */
  value: jsonb("value").notNull(),
  secret: boolean("secret").notNull().default(false),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- Redirects ---------- */

export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromPath: text("from_path").notNull(),
    toPath: text("to_path").notNull(),
    permanent: boolean("permanent").notNull().default(true),
    hits: integer("hits").notNull().default(0),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("redirects_from_idx").on(t.fromPath)],
);

/* ---------- Activity log ---------- */

export const activity = pgTable(
  "activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_created_idx").on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Content = typeof content.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Redirect = typeof redirects.$inferSelect;

/* ---------- Login throttling ---------- */

export const loginAttempts = pgTable(
  "login_attempts",
  {
    /** "email:<address>" or "ip:<address>" */
    key: text("key").primaryKey(),
    failures: integer("failures").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_last_idx").on(t.lastAttemptAt)],
);

/* ---------- Product extras (Twenty stays read-only; these live only in our database) ---------- */

export const productOverrides = pgTable("product_overrides", {
  /** masterProducts.id in Twenty */
  twentyId: uuid("twenty_id").primaryKey(),
  hidden: boolean("hidden").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  /** Optional URL slug override (otherwise derived from the Twenty name / legacy URL). */
  slug: text("slug"),
  displayName: text("display_name"),
  descriptionHtml: text("description_html").notNull().default(""),
  /** Gallery images from the media library, in display order. */
  mediaIds: uuid("media_ids")
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`),
  /** Extra image IDs in the external image service (beyond allsyDecorImageId). */
  externalImageIds: text("external_image_ids")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  /** Whether to also show images from the external image service. */
  useExternalImages: boolean("use_external_images").notNull().default(true),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductOverride = typeof productOverrides.$inferSelect;

/* ---------- Forms & leads (stored only here — never written to Twenty) ---------- */

export const leadTypeEnum = pgEnum("lead_type", ["enquiry", "sample", "download", "dealer", "video_call", "visit", "landing"]);
export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "converted", "closed", "cancelled", "spam"]);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: leadTypeEnum("type").notNull(),
    status: leadStatusEnum("status").notNull().default("new"),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    profession: text("profession"),
    city: text("city"),
    message: text("message"),
    /** Type-specific fields (sample products & address, dealer company, download id, …). */
    data: jsonb("data").notNull().default({}),
    /** For bookings (video call / showroom visit): the booked slot start. */
    slotStart: timestamp("slot_start", { withTimezone: true }),
    sourcePath: text("source_path"),
    referrer: text("referrer"),
    utm: jsonb("utm").notNull().default({}),
    ip: text("ip"),
    userAgent: text("user_agent"),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    /** Copy in Twenty CRM (create-only): "off" | "pending" | "sent" | "failed". */
    twentyStatus: text("twenty_status").notNull().default("pending"),
    twentyLeadId: text("twenty_lead_id"),
    twentyNoteId: text("twenty_note_id"),
    twentyError: text("twenty_error"),
    twentyAttempts: integer("twenty_attempts").notNull().default(0),
    twentySyncedAt: timestamp("twenty_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("leads_status_idx").on(t.status, t.createdAt),
    index("leads_twenty_idx").on(t.twentyStatus),
    index("leads_type_idx").on(t.type, t.createdAt),
    index("leads_email_idx").on(t.email),
    // One active booking per slot and booking type.
    uniqueIndex("leads_slot_idx")
      .on(t.type, t.slotStart)
      .where(sql`${t.slotStart} is not null and ${t.status} in ('new', 'contacted', 'converted')`),
  ],
);

export const leadNotes = pgTable(
  "lead_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lead_notes_lead_idx").on(t.leadId, t.createdAt)],
);

/* ---------- Generic rate limiting (forms, APIs) ---------- */

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

export type Lead = typeof leads.$inferSelect;
export type LeadNote = typeof leadNotes.$inferSelect;

/* ---------- Allsy.io media (images, brochure PDFs, videos — files live on Cloudflare R2) ---------- */

export const allsyAssetTypeEnum = pgEnum("allsy_asset_type", ["image", "pdf", "video"]);

export const allsyAssets = pgTable(
  "allsy_assets",
  {
    /** Allsy.io asset ID — the same value Twenty stores in masterProducts.allsyDecorImageId. */
    id: text("id").primaryKey(),
    type: allsyAssetTypeEnum("type").notNull(),
    /** Public (R2 / Cloudflare) URL of the file. */
    url: text("url").notNull(),
    mime: text("mime"),
    width: integer("width"),
    height: integer("height"),
    bytes: integer("bytes"),
    title: text("title").notNull().default(""),
    alt: text("alt").notNull().default(""),
    /** Normalised "group:value" tags, e.g. tone:earthy-brown, format:herringbone, room:living. */
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Twenty masterProducts.id this asset belongs to (if any). */
    productId: text("product_id"),
    /** Allsy project reference: { id, name, city, category, year, architect } */
    project: jsonb("project"),
    /** For PDFs: brochure section, e.g. "brochures/creative-collection". */
    section: text("section"),
    /** For videos: YouTube/Vimeo URL. */
    videoUrl: text("video_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Problems spotted on sync (e.g. "missing_tag"): shown in the admin, asset not published. */
    flags: text("flags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    deleted: boolean("deleted").notNull().default(false),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("allsy_assets_product_idx").on(t.productId),
    index("allsy_assets_type_idx").on(t.type, t.deleted),
  ],
);

export const syncLog = pgTable(
  "sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(), // "allsy"
    kind: text("kind").notNull(), // "webhook" | "pull"
    /** Allsy event id (replay protection for webhooks). */
    eventId: text("event_id"),
    received: integer("received").notNull().default(0),
    upserted: integer("upserted").notNull().default(0),
    deleted: integer("deleted").notNull().default(0),
    flagged: integer("flagged").notNull().default(0),
    ok: boolean("ok").notNull().default(true),
    error: text("error"),
    /** Per-item outcome: [{ id, action, flags?, error? }] (capped). */
    items: jsonb("items").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sync_log_created_idx").on(t.createdAt), uniqueIndex("sync_log_event_idx").on(t.source, t.eventId)],
);

export type AllsyAsset = typeof allsyAssets.$inferSelect;
