-- Contact details and social links move into one structured setting (config.contact).
INSERT INTO "settings" ("key", "value", "secret")
SELECT 'config.contact', jsonb_build_object(
  'phone', coalesce((SELECT value #>> '{}' FROM settings WHERE key = 'site.phone'), '+91 92120 96387'),
  'email', coalesce((SELECT value #>> '{}' FROM settings WHERE key = 'site.email'), ''),
  'social', coalesce((
    SELECT jsonb_agg(jsonb_build_object('network', replace(key, 'site.', ''), 'url', value #>> '{}') ORDER BY key DESC)
    FROM settings WHERE key IN ('site.instagram', 'site.facebook', 'site.linkedin') AND value #>> '{}' LIKE 'https://%'
  ), '[]'::jsonb)
), false
WHERE EXISTS (SELECT 1 FROM settings WHERE key IN ('site.phone', 'site.email', 'site.instagram', 'site.facebook', 'site.linkedin'))
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
-- Analytics IDs move into config.tracking.
INSERT INTO "settings" ("key", "value", "secret")
SELECT 'config.tracking', jsonb_build_object(
  'ga4', coalesce((SELECT value #>> '{}' FROM settings WHERE key = 'analytics.gaId'), ''),
  'gtm', coalesce((SELECT value #>> '{}' FROM settings WHERE key = 'analytics.gtmId'), '')
), false
WHERE EXISTS (SELECT 1 FROM settings WHERE key IN ('analytics.gaId', 'analytics.gtmId'))
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
-- Studios (a JSON text setting until now) move into config.studios.
INSERT INTO "settings" ("key", "value", "secret")
SELECT 'config.studios', (value #>> '{}')::jsonb, false FROM settings WHERE key = 'site.studios' AND (value #>> '{}') LIKE '[%'
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
DELETE FROM "settings" WHERE "key" IN ('site.phone', 'site.email', 'site.address', 'site.instagram', 'site.facebook', 'site.linkedin', 'site.studios', 'analytics.gaId', 'analytics.gtmId');
