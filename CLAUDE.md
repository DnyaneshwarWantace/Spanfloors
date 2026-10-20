# Spanefloor website

## ⚠️ MOST IMPORTANT RULE — Twenty API is READ-ONLY, with ONE exception

The client's Twenty CRM API is used **only to view data**, except for one narrow, approved case.

- Default: only HTTP `GET` requests (or GraphQL *queries*). Never `PATCH`, `PUT`, `DELETE` or update/delete mutations.
- **Only exception (approved per Wantace_SpanFloors_Proposal.pdf, "forms to Twenty CRM"):** website form submissions may **create** new records in `currentLeads`, plus one `note` + `noteTarget` attached to that new lead. Create only — never update or delete any record, never touch products or any other object, never change schema/metadata.
- All Twenty writes live in one file: `src/server/twenty-leads.ts`. Nowhere else may send a non-GET request to Twenty.
- Sending is switched on/off in Admin → Integrations (`twenty.pushLeads`). Leads are always saved in our DB first; Twenty is a copy.
- Never create test data in Twenty. If any other write seems needed, stop and ask first.

The website reads products from Twenty so new products the client adds there appear on the site automatically.

## Stack
Next.js 16 (App Router) · Tailwind CSS v4 (tokens in `src/app/globals.css` `@theme`) · Swiper · Lenis. GSAP to be added with the client's final design.

## Environment (`.env.local`)
- `TWENTY_API_URL` (default `https://api.twenty.com`), `TWENTY_API_KEY` — workspace `spanfloors.twenty.com`, read-only use.
- `TWENTY_REVALIDATE_SECONDS` — how often product data refreshes (default 300).
- `PRODUCT_IMAGE_URL_TEMPLATE` — e.g. `https://<image-store>/{id}.jpg`; `{id}` = `masterProducts.allsyDecorImageId`. Unset → logo placeholder.
- `LEGACY_SITE_URL` — where old WordPress pages stay reachable; unhandled URLs fall back to it.
- `NEXT_PUBLIC_SITE_URL` — canonical origin (default `https://www.spanfloors.com`).

## SEO rules (site replaces spanfloors.com)
- Keep existing URLs with trailing slashes. `src/data/legacy-seo.json` holds every old page's title/description/robots — `pageMetadata()` uses it for matching paths.
- Old product URLs not matching a Twenty product 308-redirect to the closest product or the category (`ProductView`). Never let an indexed URL 404.
- Products with no `category` in Twenty are hidden. Internal stock/cost fields must never reach pages (`toPublic()` in `src/lib/twenty.ts`).

## Backend / CMS (admin at /admin)
- PostgreSQL via Docker: `npm run db:up` (compose reads `docker.env`, NOT `.env` — that file holds the raw Twenty token). Schema: `src/db/schema.ts`; migrations: `npm run db:generate && npm run db:migrate`.
- Users & roles: admin (everything incl. Integrations & Users) / editor. Create or reset: `npm run admin:create -- --email … --name …`. Sessions are DB rows (SHA-256 of cookie token).
- Settings & API keys: `src/server/settings.ts` (`SETTING_DEFS`). Secrets AES-256-GCM encrypted with `APP_SECRET` — never change APP_SECRET after go-live or saved keys become unreadable.
- Media: files in `storage/uploads/`, served by `/media/[...path]`. Imported WP files live under `wp/`.
- WordPress import: `npm run import:wp` (content + media records, re-runnable). Media files: prefer `-- --from-dir <uploads backup>`; the live site's firewall blocks bulk downloads.
