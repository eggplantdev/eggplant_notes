# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Re-apply /10x-bootstrapper patches after every `10x get`

- **Context**: Any time a Module-1 lesson is re-fetched via `10x get` (m1l3/m1l4/m1l5…). The `.claude/skills/10x-bootstrapper/` files are vendored and overwritten with upstream's shipped versions on every fetch.
- **Problem**: Upstream still ships two bugs this repo patched — `audit_commands.js` as a bare `npm audit` string (fails `ENOLOCK` on pnpm) and a `.bootstrap-scaffold` temp-dir name (`create-next-app` rejects dot-prefixed names). A fetch silently reverts both, so a later `/10x-bootstrapper` run would break on this pnpm project.
- **Rule**: After any `10x get`, run `git checkout HEAD -- .claude/skills/10x-bootstrapper/` to re-apply the committed patches, then confirm `git status` shows those files unmodified.
- **Applies to**: all

## Verify against a server you confirmed bound — not a stale one

- **Context**: Manual/Playwright verification of a Next.js app via a local server. `next start` renames its process to `next-server`, so `pkill -f "next start"` never matches it; the old server keeps holding port 3000 and every "restart" silently fails with `EADDRINUSE`.
- **Problem**: The browser then hits the **stale build**, so code changes appear to have no effect. During F-01 this produced a confident-but-false conclusion ("Zod Standard-Schema validators don't populate field errors") and a needless workaround + wrong comment — all because three "fixes" were tested against an unchanged server. A wrong test is worse than no test: it manufactures false certainty.
- **Rule**: Restart by PID/port, not name: `kill $(lsof -i :3000 -sTCP:LISTEN -t)`. Before trusting any test, confirm the **new** server bound (check the start log for `Ready` AND that the listening PID changed / no `EADDRINUSE`). When a fix "has no effect," suspect the harness before re-diagnosing the code.
- **Applies to**: /10x-implement, /10x-impl-review, any manual/E2E verification
