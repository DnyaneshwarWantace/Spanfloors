#!/usr/bin/env bash
# Rebuilds deploy/seed/spanfloors-seed.sql.gz from the local database: content (with sections and fixed site
# pages), media records, product extras, redirects, reusable sections and non-secret settings.
# Never includes users, sessions, leads, logs, version history or secrets.
#   bash scripts/make-seed.sh
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=deploy/seed/spanfloors-seed.sql.gz
psqlq() { docker compose --env-file docker.env exec -T db psql -U spanfloors -d spanfloors -At -v ON_ERROR_STOP=1 "$@"; }

cols() { psqlq -c "select string_agg(quote_ident(column_name), ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='$1'"; }

copy_table() { # table, select-list override (optional), where (optional)
  local t=$1 list; list=$(cols "$t")
  local sel=${2:-$list} where=${3:-}
  echo "COPY public.$t ($list) FROM stdin;"
  psqlq -c "COPY (SELECT $sel FROM public.$t $where) TO STDOUT"
  echo '\.'
  echo
}

# People-related columns are cleared (no users are seeded).
content_sel=$(cols content | sed -e 's/"\{0,1\}author_id"\{0,1\}/NULL AS author_id/')
media_sel=$(cols media | sed -e 's/uploaded_by/NULL AS uploaded_by/')
po_sel=$(cols product_overrides | sed -e 's/updated_by/NULL AS updated_by/')
rs_sel=$(cols reusable_sections | sed -e 's/created_by/NULL AS created_by/' -e 's/updated_by/NULL AS updated_by/')
set_sel=$(cols settings | sed -e 's/updated_by/NULL AS updated_by/')

{
  echo "-- Span Floors seed data (pages and posts with sections, fixed site pages, media records, product extras,"
  echo "-- redirects, reusable sections, site settings). No users, sessions, leads, logs, versions or secrets."
  echo "-- Load AFTER the app has started once (migrations create the tables)."
  echo "BEGIN;"
  echo "SET session_replication_role = replica;"
  echo "TRUNCATE previews, editing_presence, content_revisions, content, media, product_overrides, redirects, reusable_sections, authors, settings;"
  echo
  copy_table media "$media_sel"
  copy_table content "$content_sel"
  copy_table product_overrides "$po_sel"
  copy_table redirects
  copy_table reusable_sections "$rs_sel"
  copy_table authors
  copy_table settings "$set_sel" "WHERE secret = false"
  echo "SET session_replication_role = DEFAULT;"
  echo "COMMIT;"
} | gzip -9 > "$OUT"

echo "Wrote $OUT ($(du -h "$OUT" | cut -f1))"
gunzip -c "$OUT" | grep -c '' | xargs echo "lines:"
