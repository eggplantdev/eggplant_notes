#!/usr/bin/env bash
# Snapshot the linked (prod) database, then apply pending migrations.
# The dump is a last-resort restore point — see AGENTS.md "migrations to prod".
# Set SUPABASE_DB_PASSWORD in the env to run non-interactively (else each
# dump + the push prompts for the password). Dumps land in gitignored backups/.
set -euo pipefail

cd "$(dirname "$0")/.."

stamp=$(date +%Y%m%d-%H%M%S)
dir="backups/$stamp"
mkdir -p "$dir"

echo "→ backing up linked (prod) database to $dir/"
supabase db dump --linked --role-only            -f "$dir/roles.sql"
supabase db dump --linked                         -f "$dir/schema.sql"
supabase db dump --linked --use-copy --data-only  -f "$dir/data.sql"

echo "→ backup complete; pushing pending migrations"
supabase db push

# Prune snapshots older than 7 days (mtime +7); keep recent restore points only.
pruned=$(find backups -mindepth 1 -maxdepth 1 -type d -mtime +7 -print -exec rm -rf {} + | wc -l | tr -d ' ')
[ "$pruned" -gt 0 ] && echo "→ pruned $pruned snapshot(s) older than 7 days"

echo "✓ done — restore point at $dir/ (roles → schema → data)"
