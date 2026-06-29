#!/usr/bin/env bash
# Recovery-grade dump of prod: the official Supabase three-file method
# (roles + schema + data). Unlike a single pg_dump, this IS restorable to a
# working database — see scripts/README.md and context/foundation/lessons.md.
# Usage: pnpm db:dump
#
# --linked (not --db-url): the prod pooler rejects the role dump with
# "permission denied to set role postgres"; --linked uses a privileged login role.
set -euo pipefail
cd "$(dirname "$0")/.."

ts=$(date +%Y%m%d-%H%M%S)
dir="backups/$ts"
mkdir -p "$dir"

echo "→ dumping prod (3-file recovery method) to $dir/"
supabase db dump --linked -f "$dir/roles.sql"  --role-only
supabase db dump --linked -f "$dir/schema.sql"
supabase db dump --linked -f "$dir/data.sql"   --use-copy --data-only \
  -x storage.buckets_vectors -x storage.vector_indexes

echo "✓ wrote $dir/{roles,schema,data}.sql"
ls -lh "$dir"
