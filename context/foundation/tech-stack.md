---
starter_id: next
package_manager: npm
project_name: coding-learning-companion
hints:
  language_family: js
  team_size: solo
  deployment_target: vercel
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: true
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

Solo developer with 4 years of Next.js / React / Tailwind experience shipping a personal coding-learning web app on a 3-week MVP budget. The registry's recommended `(web, js)` lead is the 10xDevs Astro starter, declined in favor of the user's home turf — Next.js with TypeScript — captured via the custom path. Next.js clears all four agent-friendly gates (typed, convention-based, popular in training data, well-documented) with bootstrapper-verified confidence, a stronger confidence rating than the declined Astro starter would have offered. Vercel is the natural deployment target: native home for Next.js, frictionless preview URLs per pull request, zero-config production deploys. CI runs through Vercel's GitHub integration; no `.github/workflows/*` workflow file ships in v1 — Vercel's build-time check is the v1 CI gate, and a GitHub Actions workflow for tests / lint / typecheck becomes a v1.1 concern. Supabase is the planned backend (Postgres + Auth + RLS per the shape-notes "Forward: tech-stack" block), added after scaffold via `@supabase/ssr` per Supabase's Next.js integration docs — roughly a 10–20 minute setup. The five-point self-check came back clean; no Socratic nudge fired. Auth feature flag is true; AI / payments / realtime / background jobs are all out of v1 MVP scope per PRD non-goals.

## Library choices made post-handoff

Captured here as they're decided so future-me has a single place to find them.

- **Note editor: CodeMirror 6.** Markdown editor with side-by-side live preview per PRD FR-007 (resolved 2026-05-26). CodeMirror 6 chosen for best-in-class code-block syntax highlighting on the languages the audience cares about (JS/TS/Python/Go/Rust). Bundles to ~150KB but lazy-loaded on the note editor route only; the dashboard / list pages stay light. Wired with `@codemirror/lang-markdown` for the editor surface and `react-markdown` + `rehype-highlight` (or shiki) for the rendered/read view.
- **Recall-scheduling algorithm: TBD.** FR-018 calls for "an established modern adaptive algorithm." Candidates: ts-fsrs (FSRS-4.5/5, Anki's current default), SuperMemo SM-2 (Anki's legacy, simpler). Decision deferred to when the review-loop slice is started.
- **Auth / DB: `@supabase/ssr`.** Per the hand-off block above. Migrations live in `supabase/migrations/`; client wiring follows the official Next.js App Router guide.
