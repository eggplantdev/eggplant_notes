# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Re-apply /10x-bootstrapper patches after every `10x get`

- **Context**: Any time a Module-1 lesson is re-fetched via `10x get` (m1l3/m1l4/m1l5…). The `.claude/skills/10x-bootstrapper/` files are vendored and overwritten with upstream's shipped versions on every fetch.
- **Problem**: Upstream still ships two bugs this repo patched — `audit_commands.js` as a bare `npm audit` string (fails `ENOLOCK` on pnpm) and a `.bootstrap-scaffold` temp-dir name (`create-next-app` rejects dot-prefixed names). A fetch silently reverts both, so a later `/10x-bootstrapper` run would break on this pnpm project.
- **Rule**: After any `10x get`, run `git checkout HEAD -- .claude/skills/10x-bootstrapper/` to re-apply the committed patches, then confirm `git status` shows those files unmodified.
- **Applies to**: all
