# `scripts/` — what each script does, line by line

> **⚠ Recovery note (read first).** A single whole-DB `pg_dump` is **not** a clean
> recovery artifact (roles live at the _cluster_ level; restoring managed-schema DDL
> over a live stack breaks ownership). The recovery artifact here is **three files**
> — roles + schema + data — produced **read-only** and **token-free**:
>
> ```bash
> # Backup — read-only via the backup_ro role (pg_read_all_data, bypassrls, no write).
> # Raw pg_dump, NOT `supabase db dump` (which issues SET ROLE postgres → denied for
> # backup_ro). A Supabase access token (PAT) can't be scoped read-only, so we avoid it.
> cp supabase/roles.sql roles.sql                          # backup_ro can't dump roles
> pg_dump "$BACKUP_RO_URL" --schema-only --schema=public \
>   | sed '/^CREATE SCHEMA public;$/d' > schema.sql         # public DDL only
> pg_dump "$BACKUP_RO_URL" --data-only --schema=auth --schema=public --schema=storage \
>   --exclude-table=storage.buckets_vectors --exclude-table=storage.vector_indexes > data.sql
>
> # Restore (into an EMPTY target — fresh project / blanked local), triggers off for data
> psql --single-transaction --variable ON_ERROR_STOP=1 \
>   --file roles.sql --file schema.sql \
>   --command 'SET session_replication_role = replica' \
>   --file data.sql --dbname "$TARGET_URL"
>
> # ⚠ THEN resync sequences — a --data-only restore leaves sequences behind the loaded
> #   rows, so the FIRST login write dies with duplicate-key on auth.refresh_tokens →
> #   "Database error granting user". Run the setval loop from lessons.md after restore.
> ```
>
> Why read-only/token-free: the clean `supabase db dump --linked` path needs a
> full-access account PAT (PATs can't be scoped read-only), which is too much privilege
> for an unattended backup. `backup_ro` is genuinely read-only, so the scheduled
> off-site backup (`.github/workflows/db-backup.yml`) and `pnpm db:dump` both use it.
> `roles.sql` is committed (`supabase/roles.sql`) because backup_ro can't dump roles;
> `db-push-safe.sh` still captures a fresh roles snapshot before each prod migration.
>
> The same three-file artifact serves **both** disaster recovery (restore into a fresh
> project) **and** local seeding (restore into a blanked local) — what you seed with is
> the recovery backup. **A recovery is only proven by a real login, never by row
> counts** — verified end-to-end 2026-06-29 (dump prod → blank local → restore → resync
> → real dashboard login). The two traps it surfaced (login broke first on ownership,
> then on lagging sequences, while row-counts looked perfect both times) are in
> `context/foundation/lessons.md`.
>
> `db-dump.sh` (`pnpm db:dump`) and `db-restore-local.sh` (`pnpm db:restore:local`)
> implement this; restoring locally doubles as the recovery drill. For **real disaster
> recovery into a fresh hosted project**, use `db-restore-hosted.sh`
> (`pnpm db:restore:hosted`) and follow the operator runbook in **`scripts/RECOVERY.md`**.

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

## `db-dump.sh` — recovery-grade 3-file dump of prod (read-only, token-free)

**What it's for:** produce the recovery backup (`roles.sql` + `schema.sql` +
`data.sql`) in `backups/<timestamp>/`. Run with `pnpm db:dump`. Restorable, unlike a
single whole-DB `pg_dump`.

```bash
url=$(grep -E '^SUPABASE_DB_URL=' .env.local | cut -d= -f2- | tr -d \"\' | xargs)
```

Reads the **backup_ro** pooler URL — a read-only role (`pg_read_all_data`,
`bypassrls`, no write grants) — from `.env.local`. `xargs` trims stray whitespace.

```bash
pgdump() { docker run --rm -e U="$url" postgres:17-alpine sh -c "pg_dump \"\$U\" $*"; }
```

A helper that runs raw `pg_dump` in a throwaway Postgres-17 container, passing the URL
as an env var (not a CLI arg → not visible in `ps`). We use **raw `pg_dump`, not
`supabase db dump`**, because the latter issues `SET ROLE postgres`, which `backup_ro`
is denied.

```bash
cp supabase/roles.sql "$dir/roles.sql"
```

`roles.sql` is the **committed baseline** — `backup_ro` can't dump roles (`pg_dumpall`
also needs `SET ROLE postgres`). Regenerate it only when cluster roles change (see its
header); `db-push-safe.sh` captures a fresh one before each prod migration anyway.

```bash
pgdump --schema-only --schema=public | sed '/^CREATE SCHEMA public;$/d' > schema.sql
```

Public DDL only (tables, RLS policies, functions, grants, indexes). `--schema-only` =
no data; `--schema=public` = just that schema. The `sed` drops the lone
`CREATE SCHEMA public;` line — the restore's blank step already recreates `public`, so
re-creating it would abort the strict (`ON_ERROR_STOP`) restore.

```bash
pgdump --data-only --schema=auth --schema=public --schema=storage \
  --exclude-table=storage.buckets_vectors --exclude-table=storage.vector_indexes > data.sql
```

The rows — from the three schemas a fresh Supabase project provides (`auth`, `public`,
`storage`), matching what the restore target expects. Raw `pg_dump` uses `COPY` by
default. `--exclude-table` (note: raw `pg_dump`'s `-x` means `--no-privileges`, so the
long form is required) skips two internal vector tables.

> Earlier this script used `supabase db dump --linked`, which is cleaner but needs a
> full-access account token (PATs can't be scoped read-only). The read-only `backup_ro`
> path above avoids that — see the recovery note at the top.

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

## `db-restore-hosted.sh` — restore a 3-file dump into a fresh HOSTED project (real DR)

**What it's for:** the actual disaster-recovery restore — rebuild prod into a **fresh
Supabase project** from a `db:dump`/server-made artifact. Run with
`TARGET=<session-pooler-url> pnpm db:restore:hosted [backup-dir]`. The step-by-step
operator runbook (create project, prove with a login, repoint the app) is in
**`scripts/RECOVERY.md`** — this section is just the _why it differs from local_.

A hosted project gives only the non-superuser `postgres` role (its `auth`/`storage`
schemas are owned by `supabase_*_admin`), so the local script's approach fails. Four
hosted-only adjustments, each a privilege wall found 2026-06-29:

1. **Enable `moddatetime` first** — a `--schema=public` dump references the extension's
   trigger function but doesn't carry the extension; a fresh project doesn't enable it.
2. **Strip `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin`** from `schema.sql` —
   `postgres` can't change another role's default privileges (already present anyway).
3. **Skip `auth.schema_migrations` + `storage.migrations` data** — framework bookkeeping
   owned by `supabase_*_admin` that `postgres` can't write (and a fresh project has it).
4. **No `roles.sql`, no manual resync** — managed roles pre-exist; the only sequence
   (`auth.refresh_tokens_id_seq`, owned by `supabase_auth_admin`) can't be `setval`'d by
   `postgres`, but `data.sql`'s own `setval` already synced it during the restore.

The script also **refuses a non-empty target** (`to_regclass('public.notes')` guard), so it
can never run over a live project. **Session pooler (5432) only** — the restore needs a
stable session (`--single-transaction`, `SET session_replication_role`).

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
