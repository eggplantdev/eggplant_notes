#!/usr/bin/env bash
# Restore a recovery-grade 3-file dump into a FRESH HOSTED Supabase project — real
# disaster recovery. This is the hosted sibling of db-restore-local.sh; the two differ
# because a hosted project gives only the non-superuser `postgres` role (its auth/storage
# schemas are owned by supabase_*_admin), whereas local restores as supabase_admin.
# Four hosted-only adjustments, all proven 2026-06-29 (see scripts/RECOVERY.md):
#   1. enable the extensions the schema needs FIRST — derived from every `create extension`
#      in supabase/migrations (a --schema=public dump references them but doesn't carry them;
#      a fresh project doesn't enable them). Auto-tracks new extensions, not just moddatetime.
#   2. strip `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` from schema.sql — postgres
#      can't change another role's default privileges (and a fresh project already has them).
#   3. skip the auth.schema_migrations + storage.migrations data (framework bookkeeping
#      owned by supabase_*_admin → postgres can't write it; already populated on a fresh project).
#   4. NO roles.sql (all managed roles pre-exist) and NO manual sequence resync (the only
#      sequence, auth.refresh_tokens_id_seq, is owned by supabase_auth_admin so postgres can't
#      setval it — but data.sql's own SELECT setval already syncs it during the restore).
#
# Usage:  TARGET='postgresql://postgres.<ref>:<pw>@aws-..pooler.supabase.com:5432/postgres' \
#           pnpm db:restore:hosted [backup-dir]
# TARGET must be the SESSION POOLER url (port 5432), NEVER the transaction pooler (6543) —
# the restore needs a stable session (SET session_replication_role, --single-transaction).
# backup-dir defaults to the newest backups/<ts>/ (use backups/from-server/<...> for a
# server-made tarball — the truest DR artifact).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${TARGET:-}" ]; then
  echo "✗ set TARGET to the fresh project session-pooler url (port 5432)" >&2; exit 1
fi

dir="${1:-$(ls -dt backups/*/ 2>/dev/null | head -n1)}"
dir="${dir%/}"
for f in schema data; do
  [ -f "$dir/$f.sql" ] || { echo "✗ $dir/$f.sql missing — run 'pnpm db:dump' first" >&2; exit 1; }
done

psql_t() { docker run --rm -i postgres:17-alpine psql "$TARGET" -v ON_ERROR_STOP=1 "$@"; }

# Guard: refuse a target that already has app data, so this can never run over a live
# project (e.g. prod). A fresh project has no public.notes table.
exists=$(psql_t -At -c "select to_regclass('public.notes') is not null" 2>/dev/null || echo connect_failed)
case "$exists" in
  t) echo "✗ TARGET already has public.notes — refusing to restore over a non-empty project" >&2; exit 1 ;;
  f) : ;; # empty project, good
  *) echo "✗ cannot reach TARGET (is it the session pooler url, port 5432?)" >&2; exit 1 ;;
esac

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
# (2) strip supabase_admin default-privilege lines postgres can't run
grep -v 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin' "$dir/schema.sql" > "$work/schema.sql"
# (3) drop the migration-tracking COPY blocks (COPY ... through the terminating \.)
awk '
  /^COPY auth\.schema_migrations /{skip=1}
  /^COPY storage\.migrations /{skip=1}
  skip && /^\\\.$/{skip=0; next}
  !skip{print}
' "$dir/data.sql" > "$work/data.sql"

echo "→ (1) enable the extensions the schema needs (derived from supabase/migrations)"
# A --schema=public dump references extension functions (e.g. extensions.moddatetime) but
# doesn't carry the extensions; a fresh project doesn't have them. Re-run every
# `create extension …` the migrations declare, so this auto-tracks new ones (never again
# the "function extensions.<x>() does not exist" wall).
exts=$(grep -rhiE '^[[:space:]]*create extension' supabase/migrations/ | sed 's/^[[:space:]]*//')
[ -n "$exts" ] && printf '%s\n' "$exts" | psql_t >/dev/null
echo "   enabled: $(printf '%s\n' "$exts" | grep -oiE 'exists [a-z_]+' | awk '{print $2}' | paste -sd, -)"

echo "→ restore filtered schema → data (no roles.sql, triggers off for data)"
docker run --rm -v "$work":/dump postgres:17-alpine \
  psql --single-transaction --variable ON_ERROR_STOP=1 \
    --file /dump/schema.sql \
    --command 'SET session_replication_role = replica' \
    --file /dump/data.sql --dbname "$TARGET" >/dev/null

echo "→ verify"
psql_t -c "select
  (select count(*) from auth.users)         as users,
  (select count(*) from public.notes)       as notes,
  (select count(*) from public.memory_cards) as cards,
  (select last_value from auth.refresh_tokens_id_seq) as rt_seq,
  (select coalesce(max(id),0) from auth.refresh_tokens) as rt_max;"

echo "✓ restored from $dir into hosted target"
echo "  NOW PROVE IT WITH A REAL LOGIN — row counts don't prove recovery. See scripts/RECOVERY.md."
