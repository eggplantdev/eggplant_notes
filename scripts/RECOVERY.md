# 🍆 Disaster recovery — fast track

**When prod is gone or corrupted, this is the minutes-not-hours path.** It restores the
daily 3-file backup into a fresh hosted Supabase project, proves it with a real login,
then repoints the app. Proven end-to-end 2026-06-29 by a direct restore + real login to the
recovered project (a Vercel deploy-level test was attempted but couldn't be isolated from
prod — see the Custom Environment note below).

> The full _why_ behind every step (the four hosted-only fixes, why row counts lie, why
> session pooler) is in `context/foundation/lessons.md`. This file is the **operator
> runbook** — follow it top to bottom.

---

## TL;DR

```bash
# 0. have the 3-file backup in a dir (FTPS tarball, or `pnpm db:dump` from a live prod)
# 1. create a fresh Supabase project, copy its SESSION POOLER url (port 5432)
export TARGET='postgresql://postgres.<ref>:<pw>@aws-1-<region>.pooler.supabase.com:5432/postgres'
# 2. one command — enables moddatetime, filters, restores, verifies
pnpm db:restore:hosted backups/from-server/<unpacked-dir>
# 3. PROVE IT — real login (see Step 3). Row counts do NOT prove recovery.
# 4. repoint the app at the new project (Step 4).
```

---

## Step 0 — get the backup (3 files: schema.sql + data.sql + roles.sql)

The daily GitHub Action (`.github/workflows/db-backup.yml`) uploads
`db_backup_<ts>.tar.gz` to FTPS (`/db_backup_eggplant_ai_notes/`). Download the newest and
unpack:

```bash
mkdir -p backups/from-server && tar -xzf db_backup_<ts>.tar.gz -C backups/from-server
ls backups/from-server/<dir>/   # → roles.sql  schema.sql  data.sql
```

If prod is still reachable and you just need a fresh copy: `pnpm db:dump` writes
`backups/<ts>/`. (In a real catastrophe prod is the thing that died — use the FTPS copy.)

Needs **Docker running** (the scripts shell out to `postgres:17-alpine`; the Mac has no
local `psql`).

## Step 1 — fresh project + SESSION POOLER url

Supabase dashboard → **New project** (free is fine). It comes up empty — that's the target.
Dashboard → **Connect → Session pooler** → copy the URI (port **5432**). URL-encode the
password if it has special chars (`@`→`%40`, `#`→`%23`, …).

```bash
export TARGET='postgresql://postgres.<ref>:<pw>@aws-1-<region>.pooler.supabase.com:5432/postgres'
```

> ⚠ **Session pooler (5432), never the transaction pooler (6543).** The restore needs a
> stable session (`SET session_replication_role`, `--single-transaction`); transaction
> mode silently drops that state and the restore fails.

## Step 2 — restore (one command)

```bash
pnpm db:restore:hosted backups/from-server/<dir>
```

`scripts/db-restore-hosted.sh` does all four hosted-only fixes for you: enables the
`moddatetime` extension, strips the `supabase_admin` default-privilege lines `postgres`
can't run, skips the `auth.schema_migrations` / `storage.migrations` bookkeeping tables,
and **omits** `roles.sql` and the manual sequence resync (the dump's own `setval` already
syncs `auth.refresh_tokens_id_seq`). It refuses any target that already has data, so it
can't run over a live project. It prints a verify row (users / notes / cards / sequence).

## Step 3 — PROVE IT with a real login (non-negotiable)

Row counts looked perfect twice while auth was still broken. **Only a login proves it.**
Grab the new project's anon key (`supabase projects api-keys --project-ref <ref>`, or the
dashboard) and run a password grant for a real account:

```bash
curl -s 'https://<ref>.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: <ANON_KEY>" -H 'Content-Type: application/json' \
  --data-binary '{"email":"<real-user>","password":"<their-password>"}'
```

`access_token` in the response = **recovery proven** (GoTrue read the restored
`auth.users`, verified the restored bcrypt hash, issued a JWT). `invalid_credentials` =
auth broke — stop and check `lessons.md`.

Optional stronger check (proves RLS + data path): use that token against
`https://<ref>.supabase.co/rest/v1/notes?select=id` — it should return only that user's rows.

## Step 4 — wire the new project into Vercel (repoint the app)

First grab the new project's keys (needs the Supabase CLI logged in — `supabase login`):

```bash
supabase projects api-keys --project-ref <ref>   # → anon + service_role  (or dashboard → Settings → API Keys)
```

The app reads **only** `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(`src/lib/env.ts`). To point **production** at the new project, replace those two (and
`SUPABASE_SERVICE_ROLE_KEY` if any server code grows to use it), then redeploy:

```bash
# overwrite each prod var with the new project's value (rm old, add new)
vercel env rm  NEXT_PUBLIC_SUPABASE_URL production --yes
printf 'https://<ref>.supabase.co'        | vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env rm  NEXT_PUBLIC_SUPABASE_ANON_KEY production --yes
printf '<anon-key>'                        | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# then redeploy prod from the dashboard, or push a commit to main (a human does this — agent never pushes)
```

> If you instead re-link the **Supabase Marketplace integration** to the new project, it
> re-provisions `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_*` / `POSTGRES_*` for you — prefer that
> over hand-setting in a real cutover, then just redeploy.

Finally, in the Supabase dashboard for the new project: **Authentication → URL
Configuration** → set `Site URL` + redirect allow-list to the prod URL
(`https://eggplant-notes.vercel.app`), or email-link logins (confirm / reset) break.

---

## Want a prod-like deploy against the recovered DB? Use a Custom Environment, NOT a branch.

The direct `curl` login in Step 3 already proves recovery — a deploy is only a nicer
surface. If you want one, **do not** try to point a `staging` branch's **Preview** env at
the recovered project with `vercel env add <NAME> preview staging`. That was attempted
2026-06-29 and **does not work** on this project:

- The Supabase **Marketplace integration** owns `NEXT_PUBLIC_SUPABASE_*` as a general
  **"Production, Preview"** var (prod value). A branch-scoped Preview var **does not win**
  over it — every preview build (staging included) silently used the **prod** URL.
- `NEXT_PUBLIC_*` is baked at **build** time, so redeploys reuse old values too.
- Symptom: a note written via the staging site landed in **prod** and showed on both URLs,
  while the throwaway DB never saw it. `vercel env pull --git-branch=staging` resolved
  `NEXT_PUBLIC_SUPABASE_URL=""`. **Staging writes hit prod.**

The correct approach is a Vercel **Custom Environment** with its own complete env set
(its `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` → the recovered project, no Marketplace var
shadowing it). Verify before writing anything by confirming a sentinel lands in the
**recovered** DB, not prod. Otherwise just trust Step 3.

> **Gotcha found the hard way:** the general **Preview** env scope was missing
> `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_EMAIL_USER`, `EMAIL_HOST/PASS/TO`,
> `OPENROUTER_ENC_KEY` (they were **Production-only**), so EVERY preview build failed
> Zod env validation at build time until added. The build validates the full server +
> client schema (`src/lib/env-schema.ts`) regardless of which vars a login actually uses —
> placeholders satisfy it for the unused ones.

## What this does NOT restore (redo manually on the new project)

- **Storage bucket FILES** — only `storage.objects` _metadata_ is in the dump; the actual
  uploads live in object storage (S3), not the DB.
- **Project config** — auth providers, email templates, redirect URLs, edge functions,
  secrets/env.
- **Encrypted-at-rest secrets are NOT portable.** The per-user OpenRouter credential is
  AES-GCM ciphertext bound to prod's `OPENROUTER_ENC_KEY`; on a new project users just
  **re-enter** their key (it re-encrypts under the new key). Treat it as a re-login, not a
  recoverable row.
