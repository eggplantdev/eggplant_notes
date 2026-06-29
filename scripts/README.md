# `scripts/` — what each script does, line by line

> **⚠ Recovery note (read first).** A single `pg_dump` is **not** a complete Supabase
> recovery artifact — database roles live at the _cluster_ level and aren't in a DB
> dump. The **official Supabase way** to back up and restore for full recovery is
> **three** dumps (roles + schema + data), restored together. It's documented at
> [supabase.com/docs/.../backup-restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
> and already implemented in `db-push-safe.sh`:
>
> ```bash
> # Backup (official three-dump method). Use --linked, NOT --db-url: the prod
> # pooler rejects the role dump ("permission denied to set role postgres").
> supabase db dump --linked -f roles.sql  --role-only
> supabase db dump --linked -f schema.sql
> supabase db dump --linked -f data.sql   --use-copy --data-only \
>   -x storage.buckets_vectors -x storage.vector_indexes
>
> # Restore (into an EMPTY target — fresh project / blanked local), triggers off for data
> psql --single-transaction --variable ON_ERROR_STOP=1 \
>   --file roles.sql --file schema.sql \
>   --command 'SET session_replication_role = replica' \
>   --file data.sql --dbname "$TARGET_URL"
>
> # ⚠ THEN resync sequences — the official docs OMIT this. A --data-only restore
> #   leaves sequences behind the loaded rows, so the FIRST login write dies with
> #   duplicate-key on auth.refresh_tokens → "Database error granting user".
> #   Run the setval loop from context/foundation/lessons.md after every restore.
> ```
>
> The same three-file artifact serves **both** disaster recovery (restore into a fresh
> project) **and** local seeding (restore into a blanked local) — so what you seed with
> is byte-identical to your recovery backup. **A recovery is only proven by a real
> login, never by row counts** — verified end-to-end 2026-06-29 (dump prod → blank local
> → restore → resync sequences → dashboard renders under a real session). Full rationale
>
> - the two traps this surfaced (login broke first on ownership, then on lagging
>   sequences, while row-counts looked perfect both times) is in
>   `context/foundation/lessons.md`.
>
> `db-dump.sh` (`pnpm db:dump`) and `db-restore-local.sh` (`pnpm db:restore:local`)
> below implement exactly this method — they ARE recovery-grade. Restoring locally
> doubles as the recovery drill.

These are the project's shell scripts. The scripts themselves stay lean (just the
commands); this file carries the **explanation and the _why_** so the executables
don't get buried in comments.

Mental model for all of them:

- They are **bash** scripts run from the repo. Every one starts by `cd`-ing to the
  repo root so it works no matter where you call it from.
- The database scripts talk to Postgres through a **throwaway Docker container**,
  because your Mac has no `psql`/`pg_dump` installed. The container is a tiny Linux
  box that _does_ have those tools; it runs one command and is deleted.

---

## `db-dump.sh` — recovery-grade 3-file dump of prod

**What it's for:** produce the official Supabase backup (`roles.sql` + `schema.sql`

- `data.sql`) in `backups/<timestamp>/`. Run with `pnpm db:dump`. This is a
  **restorable** artifact, unlike a single `pg_dump`.

```bash
set -euo pipefail
cd "$(dirname "$0")/.."
```

Safety switches (`-e` exit on error, `-u` unset-var guard, `-o pipefail` fail a pipe
if any stage fails) + `cd` to repo root so it runs from anywhere.

```bash
ts=$(date +%Y%m%d-%H%M%S); dir="backups/$ts"; mkdir -p "$dir"
```

A timestamped folder per dump (the three files live together).

```bash
supabase db dump --linked -f "$dir/roles.sql"  --role-only
supabase db dump --linked -f "$dir/schema.sql"
supabase db dump --linked -f "$dir/data.sql"   --use-copy --data-only \
  -x storage.buckets_vectors -x storage.vector_indexes
```

The three official dumps:

- **`--role-only`** → cluster-level roles (the layer a single `pg_dump` is missing).
- **schema** → table definitions, ownership, RLS policies, functions, grants, indexes.
- **`--data-only --use-copy`** → the rows, as fast `COPY` blocks. `-x storage.…`
  excludes two internal vector tables Supabase recommends skipping.
- **`--linked`, not `--db-url`** → the prod _pooler_ rejects the role dump
  (`permission denied to set role postgres`); `--linked` provisions a privileged
  login role via the Supabase API, which can dump roles.

---

## `db-restore-local.sh` — restore a 3-file dump into local (the recovery drill)

**What it's for:** rebuild your **local** database from a `db:dump` artifact — and by
succeeding, **prove the dump is restorable**. Run with `pnpm db:restore:local`.
**Replaces all local data.** For real disaster recovery you run the same restore
against a _fresh Supabase project_ instead (already empty, so skip the blank step).

```bash
dir="${1:-$(ls -dt backups/*/ 2>/dev/null | head -n1)}"; dir="${dir%/}"
```

Pick the backup dir: the argument if given, else the newest `backups/<ts>/`
(`ls -dt … | head -1`). `${dir%/}` strips a trailing slash.

```bash
SET session_replication_role = replica;
DROP ROLE IF EXISTS backup_ro;
DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;
-- TRUNCATE every auth.* and storage.* table
```

**Blank to a fresh-project state.** `session_replication_role = replica` disables FK
triggers so truncation can ignore order. We drop+recreate `public`, drop the
prod-only `backup_ro` role (else the strict restore aborts when `roles.sql` tries to
re-`CREATE` it), and truncate all user/storage data so the data load can't hit
duplicate-key. The managed schema _structure_ stays — exactly what a fresh project
already has.

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql
```

**The official restore.** `--single-transaction` + `ON_ERROR_STOP=1` = all-or-nothing
(any error rolls the whole thing back — a clean exit means a clean restore). Files
apply in dependency order: roles, then schema, then data with triggers off.

```sql
-- setval every sequence to max(id)
```

**Resync sequences — the step the official docs omit.** A data-only restore leaves
sequences behind the loaded rows, so the _first_ `INSERT` (e.g. a login writing
`auth.refresh_tokens`) reuses an existing id → duplicate-key → "Database error
granting user." The loop walks every sequence in `auth`/`storage`/`public` and
`setval`s it to its table's `max(id)`. **This is why row counts never prove a
recovery — only a real login does.**

---

## `db-push-safe.sh` — back up prod, then apply migrations to it

Not part of dump/seed, but related. Run with `pnpm db:push:safe`. It dumps the
linked prod database to `backups/<timestamp>/` (roles, schema, data as separate
files) **before** running `supabase db push`, so you always have a restore point if
a migration goes wrong. The dump-first ordering is the whole safety story.

---

## `.husky/pre-push` + `watch-deploy.sh` — the git-push automation

These run automatically when you `git push`. They are already heavily commented
inline because their logic is subtle; the short version:

- **`.husky/pre-push`** — before a push leaves your machine it: (1) reads which
  branch you're pushing to and, if it's `main` _and_ the push adds new
  `supabase/migrations/`, asks whether to migrate prod; (2) runs `typecheck` +
  `vitest` and **aborts the push if they fail**; (3) only _after_ tests pass, acts
  on the migrate decision (so a test failure can never leave prod's schema ahead of
  the deployed code); (4) kicks off the deploy watcher in the background.
- **`watch-deploy.sh`** — after the push, tails the Vercel deployment for **this
  exact commit** (matched by git SHA, not "newest deploy" — that would be racy) and
  prints its status until `READY` / `ERROR` / `CANCELED`.

The single most important idea in the pre-push hook: **tests gate everything, and
the irreversible action (migrating prod) happens last**, so the ordering itself is
the safety mechanism.
