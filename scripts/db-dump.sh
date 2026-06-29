#!/usr/bin/env bash
# Recovery-grade dump of prod — READ-ONLY and TOKEN-FREE. Produces the three files
# (roles + schema + data) restored by db-restore-local.sh. Proven restorable: see
# scripts/README.md and context/foundation/lessons.md. Usage: pnpm db:dump
#
# Reads SUPABASE_DB_URL from .env.local — the backup_ro pooler URL, a read-only role
# (pg_read_all_data, bypassrls, no write). We use raw pg_dump (NOT `supabase db dump`)
# because supabase db dump issues SET ROLE postgres, which backup_ro is denied. The
# roles file can't be dumped by backup_ro either, so it's the committed baseline
# supabase/roles.sql (regen instructions in its header).
set -euo pipefail
cd "$(dirname "$0")/.."

url=$(grep -E '^SUPABASE_DB_URL=' .env.local | cut -d= -f2- | tr -d \"\' | xargs)
ts=$(date +%Y%m%d-%H%M%S)
dir="backups/$ts"
mkdir -p "$dir"
pgdump() { docker run --rm -e U="$url" postgres:17-alpine sh -c "pg_dump \"\$U\" $*"; }

echo "→ dumping prod (read-only, 3-file) to $dir/"

# roles: the committed baseline (backup_ro can't dump roles)
cp supabase/roles.sql "$dir/roles.sql"

# schema: public DDL only. Drop the lone `CREATE SCHEMA public;` — the restore's
# blank step already recreates public, and re-creating it would abort the strict restore.
pgdump --schema-only --schema=public | sed '/^CREATE SCHEMA public;$/d' > "$dir/schema.sql"

# data: rows from the app + auth + storage schemas (matches the supabase-managed set
# a fresh project provides). raw pg_dump uses COPY by default.
pgdump --data-only --schema=auth --schema=public --schema=storage \
  --exclude-table=storage.buckets_vectors --exclude-table=storage.vector_indexes > "$dir/data.sql"

echo "✓ wrote $dir/{roles,schema,data}.sql"
echo "  tables=$(grep -c 'CREATE TABLE' "$dir/schema.sql")  copy-blocks=$(grep -c '^COPY ' "$dir/data.sql")"
