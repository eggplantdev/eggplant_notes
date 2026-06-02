<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Minimal Auth and Session (F-01)

- **Plan**: context/changes/minimal-auth-and-session/plan.md
- **Scope**: All 5 phases
- **Date**: 2026-06-02
- **Verdict**: APPROVED — both warnings fixed during triage; post-fix `tsc`/`lint`/`test` all green.
- **Findings**: 0 critical, 2 warnings, 5 observations
- **Triage**: Fixed F1, F2, F3, F4, F7 · Dismissed F5 · Skipped F6

> Note: this scorecard review (m2l3 `/10x-impl-review`) supersedes the earlier
> generic `/code-review` output preserved at `reviews/impl-review-code-review.md`.
> It resolves that review's three deferred items: (a) proxy-matcher-includes-/api
> → refuted/intentional (F4); (b) startsWith over-match → confirmed (F2);
> (c) dashboard double getUser → refuted/not-redundant (F5).

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

Automated success criteria re-run at review time: `tsc --noEmit` 0 errors, `pnpm lint` 0, `pnpm test` 3/3 pass. E2E (5.1/5.2) trusted from committed prod-build Playwright config (local stack not up at review time).

## Findings

### F1 — Unvalidated OTP `type` cast in the confirm route

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/app/api/auth/confirm/route.ts:11,15
- **Detail**: `type` is read from the query string and cast straight to `EmailOtpType` (`as EmailOtpType`), then passed to `verifyOtp({ type, token_hash })` with no allow-list. No open redirect (target at :18 is a fixed internal path, not a user-controlled `next`), and Supabase rejects mismatched token/type — blast radius is bounded. But the route trusts unvalidated input at a security boundary.
- **Fix**: Validate `type` against an explicit set (`['recovery','email']` for F-01) before calling verifyOtp; redirect to `/sign-in?error=…` on a bad type.
  - Strength: Closes the boundary; matches the "validate at the edge" discipline the Server Actions already use.
  - Tradeoff: A few lines; must keep the set in sync as email flows expand (F-02+).
  - Confidence: HIGH — verifyOtp's accepted types are well-defined.
  - Blind spot: None significant.
- **Decision**: FIXED — added `ALLOWED_OTP_TYPES` allow-list; bad/absent type falls through to `/sign-in?error=…`.

### F2 — Proxy public-route check over-matches via startsWith

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/proxy.ts:48,52
- **Detail**: `AUTH_ROUTES.some(r => pathname.startsWith(r))` and `startsWith('/update-password')` treat `/sign-in-evil`, `/update-password-x`, `/reset-password-anything` as public. The only security-relevant edge: a signed-out hit on such a path is classed public and skips the optimistic gate. Contained today — no such routes exist, all real protected routes live under `(protected)` and are backstopped by the layout `getUser()` re-check (src/app/(protected)/layout.tsx:14), and unknown paths 404.
- **Fix**: Match exactly — `r === pathname || pathname.startsWith(r + '/')`.
  - Strength: Removes the prefix-bleed class entirely; trivial edit.
  - Tradeoff: None.
  - Confidence: HIGH — pure predicate tightening, backstopped by the layout anyway.
  - Blind spot: None significant.
- **Decision**: FIXED — added `matchesPath` (exact-or-subpath) helper; replaced both `startsWith` checks.

### F3 — confirm route has no try/catch around verifyOtp

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/api/auth/confirm/route.ts:8-23
- **Detail**: Relies on verifyOtp returning `{ error }` rather than throwing. A thrown boundary error (network) 500s instead of hitting the `/sign-in?error=` fallback. Acceptable for MVP.
- **Fix**: Wrap the verifyOtp call in try/catch; on throw, redirect to `/sign-in?error=…`.
- **Decision**: FIXED — wrapped only verifyOtp (redirect kept outside try so NEXT_REDIRECT isn't swallowed); thrown error falls through to the error redirect.

### F4 — proxy matcher runs ALL /api/_, not just /api/auth/_

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/proxy.ts:71
- **Detail**: Intentional & correct for F-01 (confirm callback needs cookie propagation; `isPublic` whitelists `/api/auth/`). No other API routes exist yet. Worth a one-line comment so a future `/api/*` route author knows it runs through the proxy.
- **Fix**: Add a comment at the matcher explaining /api is intentionally included.
- **Decision**: FIXED — added a NOTE comment at the matcher explaining /api inclusion + the isPublic rule for future /api routes.

### F5 — dashboard calls getUser() after the layout already did

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/(protected)/dashboard/page.tsx:8
- **Detail**: Refuted as redundant — layout call is the gate, page call reads `user.email` for display; request-scoped, not a second round-trip. Prior `/code-review` flagged this; verified benign.
- **Fix**: None needed (informational).
- **Decision**: DISMISSED — verified NOT redundant. The layout's getUser() is the authoritative gate; the page's call reads `user.email` for display. Under @supabase/ssr both are served from the same request-scoped context within one request (not a second auth round-trip), and the page can't assume a user without its own read. Hoisting via context would be over-engineering for a stub page (real dashboard is S-04). Prior /code-review's "redundant double call" was a false positive; recording the dismiss so it isn't re-flagged.

### F6 — TanStack Form ^1.33.0 vs plan's ^1.27.7

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: package.json
- **Detail**: Already reconciled in AGENTS.md/CLAUDE.md as the mirrored version; the plan text is just stale. No action.
- **Fix**: None needed (plan is the stale artifact).
- **Decision**: SKIPPED — docs (AGENTS.md/CLAUDE.md) already record ^1.33.0 as the mirrored version; the plan is an immutable historical artifact being re-archived, not worth back-editing.

### F7 — schema file is schema.ts; plan/AGENTS.md say schemas.ts

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/features/auth/schema.ts
- **Detail**: Cosmetic doc/code drift; a future agent grepping `schemas.ts` finds nothing. Either rename the file or fix the docs.
- **Fix**: Rename `schema.ts` → `schemas.ts` to match docs, or correct the docs to `schema.ts`.
- **Decision**: FIXED — `git mv schema.ts → schemas.ts`; updated all 9 importers (4 pages, 4 actions, 1 test) to `@/features/auth/schemas`. Now matches the AGENTS.md feature-first naming.
