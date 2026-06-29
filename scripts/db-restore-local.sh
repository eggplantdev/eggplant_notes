#!/usr/bin/env bash
# Restore a recovery-grade 3-file dump into the LOCAL database — the disaster-
# recovery DRILL. It blanks local to a fresh-project state, restores the dump
# the official way, then resyncs sequences (the step the official docs omit, without
# which the first login fails with "Database error granting user"). Succeeding here
# PROVES the dump is restorable. Replaces all local data. Usage: pnpm db:restore:local [backup-dir]
#
# For real disaster recovery you run the SAME dump against a fresh Supabase project
# instead of local — it's already empty, so skip the blank step (lines under "BLANK").
set -euo pipefail
cd "$(dirname "$0")/.."

dir="${1:-$(ls -dt backups/*/ 2>/dev/null | head -n1)}"
dir="${dir%/}"
for f in roles schema data; do
  [ -f "$dir/$f.sql" ] || { echo "✗ $dir/$f.sql missing — run 'pnpm db:dump' first" >&2; exit 1; }
done

LOCAL='postgresql://supabase_admin:postgres@host.docker.internal:54322/postgres'
psql_local() { docker run --rm -i postgres:17-alpine psql "$LOCAL" -v ON_ERROR_STOP=1 "$@"; }

echo "→ BLANK local to fresh-project state"
psql_local >/dev/null <<'SQL'
SET session_replication_role = replica;
DROP ROLE IF EXISTS backup_ro;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('auth','storage') LOOP
    EXECUTE format('TRUNCATE TABLE %I.%I CASCADE', r.schemaname, r.tablename);
  END LOOP;
END $$;
SQL

echo "→ RESTORE $dir (official roles → schema → data, triggers off for data)"
docker run --rm -v "$PWD/$dir":/dump postgres:17-alpine \
  psql --single-transaction --variable ON_ERROR_STOP=1 \
    --file /dump/roles.sql --file /dump/schema.sql \
    --command 'SET session_replication_role = replica' \
    --file /dump/data.sql --dbname "$LOCAL" >/dev/null

echo "→ RESYNC sequences (prevents duplicate-key on first write)"
psql_local >/dev/null <<'SQL'
DO $$ DECLARE r record; mx bigint; BEGIN
  FOR r IN SELECT n.nspname sch, s.relname seq, t.relname tbl, a.attname col
    FROM pg_class s JOIN pg_depend d ON d.objid=s.oid AND d.deptype='a'
    JOIN pg_class t ON t.oid=d.refobjid
    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid
    JOIN pg_namespace n ON n.oid=s.relnamespace
    WHERE s.relkind='S' AND n.nspname IN ('auth','storage','public') LOOP
    EXECUTE format('SELECT coalesce(max(%I),0) FROM %I.%I', r.col, r.sch, r.tbl) INTO mx;
    EXECUTE format('SELECT setval(%L, %s, true)', r.sch||'.'||r.seq, GREATEST(mx,1));
  END LOOP;
END $$;
SQL

echo "✓ local restored from $dir — verify with a REAL login (row counts don't prove recovery)"
