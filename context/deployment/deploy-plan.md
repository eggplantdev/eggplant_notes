# Deploy record — coding-learning-companion (m1l5)

> Status: **DONE.** Written 2026-06-01 as a record of the achieved deploy, not a forward plan.
> The m1l5 goal (first deploy of the scaffold + persist the plan) is satisfied by the state below.

## Decision input

- Platform chosen by `/10x-infra-research` → `context/foundation/infrastructure.md`: **Vercel** (runner-up Cloudflare, third Railway).
- Target for this milestone: deploy the **empty Next.js 16 scaffold** to production. No Supabase yet (that is sprint Phase A, after deploy).

## Achieved state

| Field            | Value                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Live prod URL    | `https://coding-learning-companion-theta.vercel.app` (HTTP 200, serves scaffold)         |
| Account / scope  | `eggplantdev` → personal scope `eggplants-projects-07c20257`                             |
| orgId            | `team_eTY61jJROGLC3P8x6Tvi1doZ` (personal northstar team)                                |
| projectId        | `prj_jYwukp9E4Qy8uzDbyPfQliNdTvCt`                                                       |
| Git link         | GitHub `github.com/ex-Plant/coding-learning-companion`, repo-level (`.vercel/repo.json`) |
| Framework / Node | nextjs / 24.x                                                                            |
| Function region  | `fra1` (EU — co-located with future Supabase EU region)                                  |
| CI gate          | Vercel GitHub integration — push to `main` → prod; PR/branch → preview                   |

## What happened (scope cleanup)

The project was originally mis-linked to the unrelated **`wykonczymys-projects` team** (orgId `team_BWfyTqJnjIqZBkHwBL0elgS4`, old projectId `prj_xiMPGCdLzFUsgDmWHRiEtVzG9JK9`) — an accident at an earlier `vercel link` scope prompt. Re-linked to the personal account:

```
rm -rf .vercel && vercel link --yes --project coding-learning-companion
# NOTE: omit --scope — personal accounts reject `--scope` ("cannot set your Personal Account as the scope")
```

Symptom that flagged the bad link: `vercel whoami` returned `Not authorized` even after a successful `vercel login`, because the CLI resolved scope from the stale `.vercel/` pointing at a team the account can't access. Deleting `.vercel/` and re-linking fixed both.

## Follow-ups

- [x] Region → `fra1` (done 2026-06-01, ahead of Supabase to avoid cross-region latency).
- [ ] Delete the orphaned `wykonczymys-projects` project `prj_xiMPGCdLzFUsgDmWHRiEtVzG9JK9` when convenient (shared team, low priority).
- [ ] **Env migration (Phase A+):** as services come online (Supabase, Resend, …), add vars via `vercel env add` → `vercel env pull .env.local`. Never hand-edit `.env.local` — overwritten on next pull.
- [ ] Consider typed `vercel.ts` config (over `vercel.json`) once build settings need to be version-controlled.
