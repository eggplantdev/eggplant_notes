---
project: coding-learning-companion
researched_at: 2026-06-01
recommended_platform: Vercel
runner_up: Cloudflare (Workers + OpenNext)
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Next.js 16 (App Router) + React 19
  runtime: Node 24
  database: Supabase (Postgres + Auth + RLS, external)
---

## Recommendation

**Deploy on Vercel.** Next.js is Vercel's own framework, so it's the only candidate where the runtime is purpose-built for the stack — zero-config, native ISR/image optimization, mature `vercel` CLI for deploy/rollback/logs/env. For a solo developer on a 9-day MVP deadline who prioritized DX and is already familiar with Vercel, the native fit plus the free Hobby tier (sufficient for a personal, non-commercial app) outweighs the cheaper-but-frictional edge alternatives. Single-region is acceptable, so Vercel's lack of automatic global edge for SSR is a non-issue — we pin the function region to EU to sit next to Supabase.

## Platform Comparison

| Platform       | CLI-first                 | Managed/Serverless     | Agent-readable docs | Stable deploy API | MCP / Integration  | Next.js 16 fit           |
| -------------- | ------------------------- | ---------------------- | ------------------- | ----------------- | ------------------ | ------------------------ |
| **Vercel**     | Pass                      | Pass                   | Pass                | Pass              | Partial (MCP beta) | **Pass — native**        |
| **Cloudflare** | Pass                      | Pass                   | Pass                | Pass              | Pass               | Partial — OpenNext beta  |
| **Railway**    | Pass (rollback=dashboard) | Partial (always-on)    | Pass                | Pass              | Pass               | Pass                     |
| **Render**     | Partial (no CLI rollback) | Pass                   | Pass                | Pass              | Pass               | Pass                     |
| **Netlify**    | Pass                      | Pass                   | Pass                | Pass              | Pass               | Pass (OpenNext)          |
| **Fly.io**     | Pass                      | Fail (BYO Docker/IaaS) | Partial             | Pass              | Partial            | Partial (BYO Dockerfile) |

Hard filter (Q1 = no persistent connections / background workers) dropped nothing — the app is stateless request/response. Soft weights: DX prioritized, Vercel familiarity as tie-break, single-region (neutralizes Cloudflare's edge advantage), external Supabase (co-located DBs score nothing).

### Shortlisted Platforms

#### 1. Vercel (Recommended)

Native Next.js host: zero build config, ISR/image optimization/Fluid Compute work out of the box. Mature CLI (`vercel`, `vercel --prod`, `vercel rollback`, `vercel logs`, `vercel env`). Free Hobby tier covers a personal MVP at 10k–100k req/mo. Function region pinnable to EU (`fra1`) to co-locate with Supabase. The developer already runs Vercel for `wykonczymy`. Cost: free (Hobby, non-commercial).

#### 2. Cloudflare (Workers + OpenNext)

Cheapest (free tier = 100k req/**day**), best agent-operability (published `llms.txt`, GA MCP servers incl. docs/observability/bindings), mature `wrangler`. The gap: Next.js 16 runs **only** via the **beta** `@opennextjs/cloudflare` adapter (Node-runtime-only, no edge runtime) with an **open, untriaged** Proxy/middleware bug ([workers-sdk#13755](https://github.com/cloudflare/workers-sdk/issues/13755)). That adapter friction is the documented exit path if Vercel lock-in or pricing ever bites — not where a deadline-bound solo dev should start.

#### 3. Railway

Smoothest **non-serverless** Next.js: standard Node build (Railpack/Dockerfile, `output: "standalone"`), no adapter, no cold starts (always-on), good remote MCP (`mcp.railway.com`). No real free tier — ~$5/mo Hobby for a small always-on service. The fallback that avoids both Vercel lock-in and Cloudflare's adapter pain; pick it if cold starts or serverless limits ever hurt.

_Not shortlisted:_ Netlify (viable via OpenNext, but no advantage over Vercel for a Next.js app + per-invocation free-tier caps); Render (free tier spins down → 30–60s cold starts; $7/mo to remove; no CLI rollback); Fly.io (container IaaS, BYO Dockerfile — over-engineered for a stateless app, per its own assessment).

## Anti-Bias Cross-Check: Vercel

### Devil's Advocate — Weaknesses

1. **Hobby tier is non-commercial only.** Fine as a learning app, but any monetization (donations, paid tier) violates ToS and forces Pro ($20/mo).
2. **Bill-shock surface.** Active-CPU + per-invocation pricing means a bot or a misconfigured ISR `revalidate` can spike cost; spend caps exist but are off by default.
3. **Lock-in via Next.js features.** Heavy use of ISR, image optimization, and `vercel.ts` makes a future migration to Cloudflare/self-host costly.
4. **Wrong team scope.** The project is currently linked to the `wykonczymys-projects` team — deploying now co-mingles billing/env with the unrelated `wykonczymy`.
5. **Vercel MCP is beta.** Agent-operability leans on the CLI rather than a GA MCP.

### Pre-Mortem — How This Could Fail

The app gained a little cohort traction. A few users hammered the review API, and an ISR misconfiguration revalidated on nearly every request — function invocations and Active-CPU climbed. Because the project was still on the shared `wykonczymys-projects` team, the usage co-mingled with `wykonczymy`'s billing and confused a teammate who saw charges they didn't cause. Meanwhile the developer had leaned into Vercel-specific image optimization and ISR, so the cost-cutting migration to Cloudflare required adopting the beta OpenNext adapter and rewriting the image pipeline — weeks of work. The "free, zero-config" start had quietly become a paid, locked-in dependency. Root causes: deployed on the wrong scope, set no spend cap, kept no exit path open.

### Unknown Unknowns

- **Function region vs Supabase region.** If Vercel functions deploy to the US default (`iad1`) while Supabase is in the EU, every query crosses the Atlantic. Pin both to the same EU region.
- **Hobby preview URLs are public by default** — Deployment Protection is a paid-tier feature.
- **The non-commercial clause** is easy to forget until a "buy me a coffee" button quietly breaches it.
- **`.vercel/project.json` is git-ignored** by CLI convention, so the (wrong) linkage isn't visible in the repo diff — easy to forget it's misconfigured.

## Operational Story

- **Preview deploys**: every branch `git push` → Vercel GitHub integration builds a preview URL; `vercel` (CLI) also makes one. Previews are **public** on Hobby (no protection without a paid tier) — acceptable for a personal app.
- **Secrets**: `vercel env add <NAME>` (choose production/preview/development) stores in the Vercel project env vault; `vercel env pull .env.local` syncs down. **Currently deferred** — env lives directly in git-ignored `.env.local` until first deploy. Once on Vercel, vars must land in the _correct_ (re-linked) project scope.
- **Rollback**: `vercel rollback <deployment-url>` (or promote a prior deployment in the dashboard) — near-instant, re-points the production alias. **Caveat:** Supabase migrations are forward-only and do **not** roll back with the deploy; a schema change must be reverted with its own down-migration.
- **Approval**: production publish (`vercel --prod` or merge to `main`) is the human-gated action; previews are automatic and safe. Destructive actions (delete project, rotate secrets, drop DB) are done by a human in the dashboard, never the agent.
- **Logs**: `vercel logs <url>` (runtime), `vercel ls` (deploy list), `vercel inspect <url>`. Vercel MCP (beta) is the structured alternative once GA.

## Risk Register

| Risk                                      | Source                              | Likelihood | Impact | Mitigation                                                                                                 |
| ----------------------------------------- | ----------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| Hobby non-commercial ToS breach           | Devil's advocate / Unknown unknowns | M          | M      | Keep v1 non-commercial; budget Pro ($20/mo) before any monetization                                        |
| Bill-shock from invocation/CPU spike      | Devil's advocate / Pre-mortem       | L          | M      | Enable Vercel Spend Management (pause-at-limit); keep ISR `revalidate` conservative                        |
| Wrong team-scope linkage                  | Pre-mortem / project state          | H          | M      | Re-link to personal scope **before** first deploy: `rm -rf .vercel && vercel link` → pick `admin-63074310` |
| Lock-in via Next.js-specific features     | Devil's advocate / Pre-mortem       | M          | M      | Keep ISR/image usage modest; Cloudflare+OpenNext is the documented exit path                               |
| Function/Supabase region mismatch latency | Unknown unknowns                    | M          | M      | Pin Vercel functions to EU (`fra1`) and create Supabase in the same region                                 |
| Public preview URLs on Hobby              | Unknown unknowns                    | L          | L      | Acceptable for a personal app; Deployment Protection (paid) if needed                                      |
| Vercel MCP beta                           | Devil's advocate                    | L          | L      | Use `vercel` CLI for agent ops; adopt MCP when GA                                                          |

## Getting Started

Version-accurate for Next.js 16 + the current Vercel CLI (no adapter required — native):

1. **Fix the linkage first** (highest-leverage risk): `rm -rf .vercel && vercel link` → choose the **personal** scope (`admin-63074310`), not the `wykonczymys-projects` team. Verify with `cat .vercel/project.json` (orgId should **not** start with `team_`).
2. **Pin the EU region** to co-locate with Supabase: Project Settings → Functions → Region = `fra1` (Frankfurt), or set `regions` in `vercel.ts`. Create the Supabase project in the same region.
3. **No adapter, no `vercel dev`.** Next.js 16 deploys natively; local dev stays `pnpm dev` (Turbopack already has runtime fidelity — a separate `vercel dev` is redundant).
4. **Enable Spend Management** (Dashboard → Settings → Billing) — set a pause-at-limit cap to neutralize bill-shock.
5. **First deploy**: `vercel` (preview) to validate the pipeline, then `vercel --prod` (or merge to `main`). Manage env via `vercel env add` → `vercel env pull .env.local`.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration (Vercel needs none for Next.js)
- CI/CD pipeline files (Vercel's GitHub integration is the v1 gate; no `.github/workflows/*`)
- Production-scale architecture (multi-region, HA, DR)
