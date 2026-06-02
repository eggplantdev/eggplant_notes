# Implementation Review — minimal-auth-and-session (F-01)

> Reviewed 2026-06-02 via `/code-review` (7 finder angles: 3 correctness + 3 cleanup + altitude)
> over the F-01 diff `9be0a54..HEAD`, plus an end-to-end Playwright verification pass against a
> production build. `/10x-impl-review` (m2l3) was fetched mid-session; this artifact records the
> `/code-review` outcome rather than re-running.

## Verdict

**Ship.** No correctness bugs survived verification. All five auth flows verified working
end-to-end on a confirmed-current build (see Evidence). Findings were prod-readiness, efficiency,
and cleanup — the two acted-on items are resolved; three are recorded follow-ups.

## Evidence (Playwright, prod build, verified server PID each run)

- **3.5 sign-up** → user created + session → `/dashboard`.
- **3.6 sign-in / sign-out** → both work; session cleared on sign-out.
- **3.7 reset round-trip** → request → Mailpit email → `/api/auth/confirm` (PKCE `verifyOtp`) →
  `/update-password` → new password → sign in with new password → `/dashboard`.
- **3.8 inline validation** → invalid email/short password render field errors (`aria-invalid=true`).
- **4.4** `/dashboard` signed-out → `/sign-in`. **4.5** `/sign-in` signed-in → `/dashboard`.
- **4.6** layout backstop confirmed by isolation test (proxy matcher temporarily excluded
  `/dashboard`; signed-out hit still redirected — only the `(protected)` layout could do that).

## Findings

| #   | File                                            | Finding                                                                                                             | Disposition                                                                                                                              |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `features/auth/actions/reset-password.ts`       | Hardcoded `http://127.0.0.1:3000` origin fallback → broken recovery links if `origin` header absent on preview/prod | **Fixed** — falls back to `SITE_URL` from the zod-validated `@/lib/env` (commit `19a9c05`)                                               |
| 3   | `features/auth/actions/*`                       | 4 actions duplicated the `validate → client → call → normalize` skeleton                                            | **Fixed** — extracted `runAuthAction` (`19a9c05`)                                                                                        |
| 2   | `proxy.ts` matcher                              | Matcher doesn't exclude `/api`, so `getUser()` (network) runs on every API request                                  | **Deferred** — only `/api/auth/confirm` exists today; revisit when API routes grow (exclude `/api` or use `getClaims()` on the hot path) |
| 4   | `proxy.ts:48,52`                                | `startsWith` over-matches (`/sign-in` ⊃ `/sign-in-x`, `/update-password` ⊃ `/update-passwordX`)                     | **Deferred** — no sibling routes exist in v1; tighten to exact/`/`-boundary if the route set grows                                       |
| 5   | `(protected)/layout.tsx` + `dashboard/page.tsx` | Both call `getUser()` → 2 auth calls per dashboard render                                                           | **Deferred** — minor; pass user down from layout if it becomes hot                                                                       |

### Considered and discounted (false positives)

- "Server Action `redirect()` breaks the `Promise<ActionResultT>` contract / makes the error
  handler dead code" — **no**: this is the intended Next.js pattern; `redirect()` throws
  `NEXT_REDIRECT`, the `if (!result.success)` branch runs only on the error return.
- "`redirectTo` cookie-copy helper in proxy is overengineered" — **no**: copying the refreshed
  cookies onto the redirect response is required by the Supabase SSR spec, else the session is
  dropped on redirect.
- "`src/proxy.ts` not registered (no `middleware.ts`)" — **no**: `src/proxy.ts` is the Next.js 16
  convention; build emits `ƒ Proxy (Middleware)`.

## Process note

A stale `next-server` (renamed process, missed by `pkill -f "next start"`) held port 3000, so
early validation ran against an unchanged build and produced a false diagnosis. Captured as a
lesson in `context/foundation/lessons.md` (verify against a server you confirmed bound).
