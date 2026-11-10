# Span Floors admin vs Totem (OIM) admin

Written 26 Oct 2026 for the Totem chat, after the Span Floors backend plan was built. Both codebases were read on that date.

- **Span Floors**: `~/Downloads/spanefloor`. Next.js 16, PostgreSQL, Drizzle. The admin is hand-built in `src/app/admin`.
- **Totem / OIM**: `~/Downloads/totem/oim-web`. Next.js and Payload CMS. Many admin features come from Payload itself, such as versions, drafts, live preview and focal point.

Use the two "should take" lists below to decide what to port. Paths point to the files to read first.

## Side by side

| Feature | Span Floors | Totem | Notes |
|---|---|---|---|
| Page builder with sections | Yes (17 types) | Yes (36 types) | Totem has more section types and a preview picker |
| Reusable sections used on many pages | Yes | No | Span Floors shows where each one is used and can detach it |
| Version history, compare, restore | Yes | Yes | Span Floors can also restore a single section |
| Preview while editing | Yes (desktop/tablet/phone) | Yes (live preview) | |
| Shareable preview link without login | Yes (expires in 7 days) | No | |
| Someone-else-is-editing warning and save conflicts | Yes | No | |
| Scheduled publish | Yes | Yes | |
| Scheduled unpublish (end date) | Yes | No | |
| Share previews (WhatsApp, Telegram, social, Google) | Yes | Yes | |
| Automatic branded share image | Yes (JPEG under 300 KB) | Yes | |
| Live SEO checklist while typing | Yes | No | Totem has a Google PageSpeed button instead |
| Google PageSpeed check | Waiting for key | Yes | |
| AI-written SEO title and description | Waiting for key | Yes | |
| llms.txt | Yes | Yes | |
| Answer-engine fields (short answer, takeaways, Q&A) | Yes (pages and posts) | Yes (blog posts) | |
| 404 log | Yes | Yes (`MissingPages`) | |
| Broken-link scan and IndexNow pings | Yes | No | |
| Old site SEO kept per URL | Yes | No | |
| Old URLs redirect to the closest match | Yes | No | |
| WordPress page, blog and media importers | Yes | No | |
| Redirects: hit counts, CSV import, chain warning | Yes | Partial | Totem has a redirect list |
| Media: focal point and sizes | Yes | Yes | |
| Media: where used, duplicates, unused, replace, folders | Yes | No | |
| Header and footer menu editor | Yes | Yes | |
| Shared texts | Yes | Yes | |
| Cookie banner and announcement bar | Yes | Partial | |
| Per-form field settings (optional, required, hidden) | Yes | No | |
| Leads copied to a CRM with retries | Yes (Twenty) | Yes (several CRMs) | |
| Lead scoring and AI brief | No | Yes | Not needed for Span Floors yet |
| Bookings with time slots | Yes | No | |
| Integration test buttons and integration log | Yes | Yes | |
| Roles | 4 (admin, editor, author, sales) | 4 | |
| Login lockout | Yes | Yes (Payload `maxLoginAttempts`) | |
| Two-step login with recovery codes | Yes | No | |
| Signed-in devices and "sign out everywhere else" | Yes | No | |
| Ctrl/Cmd-K admin search | Yes | No | |
| Section guide (all sections with sample content) | Yes | No | |
| Activity log page with filters | Yes | Partial | Totem has lead activity only |
| Backups page | Yes | No | |
| Automated tests | No | Yes (Vitest, Playwright) | |
| Docker deploy, nightly backups, seed without secrets | Yes | Partial | |

## What Totem should take from Span Floors

These are ordered by value to an admissions site.

1. **Shareable preview links.** Counsellors and the client can review a draft without an admin login.
   - Files: `src/server/previews.ts`, `src/app/(site)/preview/[token]/page.tsx`
   - The frame is only allowed on the site's own origin, and links expire after 7 days.
2. **Scheduled unpublish.** Useful for admission deadlines and campaign pages.
   - The `unpublishAt` field and `isLive()` are in `src/server/content.ts`.
3. **Live SEO checklist.** Scores the page in the editor as you type.
   - Files: `src/server/seo-check.ts`, `src/components/admin/SeoPanel.tsx`
   - Totem only has the PageSpeed button.
4. **Broken-link scan and IndexNow.**
   - Files: `src/server/seo-audit.ts` (`scanBrokenLinks`), `src/server/indexnow.ts`
   - Totem already has the 404 log.
5. **Media housekeeping.** Where-used, duplicate detection by sha256, unused filter, replace that keeps the URL, and folders.
   - Files: `src/server/media-usage.ts`, `src/app/admin/(panel)/media/actions.ts`
6. **Two-step login and a devices list.**
   - Files: `src/server/totp.ts` (RFC 6238 with no extra dependencies, plus recovery codes), `finishTwoStep` in `src/server/auth.ts`, `src/app/admin/(panel)/account/`
   - In Payload this needs a custom login step, or a plugin if a maintained one exists.
7. **Ctrl/Cmd-K search.** Files: `src/components/admin/CommandPalette.tsx`, `src/app/admin/(panel)/search-actions.ts`
8. **Section guide page.** Every block rendered with sample content, which helps the design agency. File: `src/app/(site)/preview/components/page.tsx`
9. **Reusable sections and single-section restore.**
   - Files: `src/app/admin/(panel)/reusable/`, `src/server/revision-diff.ts`
10. **Per-form field settings.** File: `src/lib/form-fields.ts`, enforced on the server in `src/server/forms.ts`.
11. **Editing presence and save conflicts.** `editing_presence` table, and `loadedAt` / `force` in `saveContent`.
12. **Backups page.** File: `src/app/admin/(panel)/settings/backups/page.tsx`. Mount the backups folder read-only.

## What Span Floors should take from Totem

1. **Automated tests.** Totem has Vitest and Playwright. Span Floors has none, only manual browser checks during the build. Start with:
   - forms
   - lead push to Twenty (mocked)
   - section cleaning
   - redirects
2. **More section types.** Totem has 36. Candidates worth porting:
   - timeline
   - comparison table
   - team
   - tabs or accordion
   - map with several locations
3. **PageSpeed and AI SEO buttons.** They are built in Span Floors' plan (items 3.6 and 3.7) and are waiting only for the PageSpeed and Anthropic keys. Totem's versions are in `src/globals/Integrations.ts`.
4. **Several CRM targets.** Only if Span Floors ever leaves Twenty.

## Rules that differ

- **Span Floors' Twenty CRM is read-only.** The one exception is creating website leads, and all writes to Twenty are in `src/server/twenty-leads.ts`. Do not copy Totem's CRM sync patterns into Span Floors without keeping this rule.
- **Span Floors never uses a native `<select>`.** It uses `src/components/ui/Dropdown.tsx`.
