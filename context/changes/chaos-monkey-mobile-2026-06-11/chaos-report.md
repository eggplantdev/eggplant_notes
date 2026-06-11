# Chaos Monkey Report — Mobile View, Live Production

- **Target:** https://eggplant-ai-notes.vercel.app
- **Viewport:** 390 × 844 (iPhone 13 class), mobile
- **Date:** 2026-06-11
- **Method:** Exploratory destructive testing (chaos monkey) via Playwright against the live prod deploy
- **Test account:** ka@bayalab.com (created for this run)

Severity legend: 🔴 High · 🟠 Medium · 🟡 Low · 🔵 Info/observation

---

## Executive summary

**21 findings (0 🔴 · 9 🟠 · 11 🟡 · 1 🔵)** across two rounds. Round 1 sampled the surfaces (auth, one note/card, search, settings). Round 2 is a **full audit**: complete CRUD on subjects/notes/cards, the review session, import, every settings section + dialog, **all HTTP API endpoints**, FAQ, contact, IDOR, and sign-out.

**Security is genuinely solid** — XSS sanitised end-to-end (title/body/preview/import/cards), SQL parameterised (no injection), no user-enumeration on login/reset, **IDOR-safe** (others' UUIDs 404 via RLS, both UI and API), the token API has clean 401s and strict Zod validation, OpenRouter uses OAuth+PKCE, and destructive actions are gated (note/card/subject delete confirm-gated; sample-wipe password-gated; **account delete double-gated** with case-sensitive `DELETE` + password). The token lifecycle (mint→use→revoke→reject) is correct.

The real theme is **silent server-action failures**, not security. Two patterns dominate:

Top issues to fix first:

1. **F6 + F18 🟠 (same root cause)** — a control char (e.g. null byte) in a title passes Zod then dies at Postgres, returning the **same opaque "Failed to create note" — as an unhandled HTTP 500 on the API**, reachable by any token holder. Fix once in the shared `*-core` Zod schema (strip/reject control chars) → closes UI + API.
2. **F11 🟠** — a notes-search query (`' OR 1=1 --`) crashes the whole page with an unhandled 500; reachable with ordinary code searches.
3. **F16 🟠 (systemic)** — server-action **Save/Create needs two clicks** with no feedback on the first — reproduced on **sign-up, subject-edit, card-edit, token-create** (note-edit + note/card/subject create work first-click → inconsistent shared hook). Token-create thankfully does **not** double-mint.
4. **F10 🟠** — you can grade a review card without revealing the answer (defeats spaced repetition; misclicks reschedule cards).
5. **F7 🟠 + F1 🟠** — new-user first-note trap (subject defaults to "Existing → None"); auth errors not announced to screen readers.

Recurring meta-point: **the token API returns precise validation errors the UI swallows into generic ones** (F8). The fix is to surface the core's messages in the UI.

| ID  | Sev | Area       | One-liner                                                               |
| --- | --- | ---------- | ----------------------------------------------------------------------- |
| F1  | 🟠  | Sign-in    | Auth error has no `role=alert`/`aria-live` (silent for screen readers)  |
| F2  | 🟡  | Sign-in    | Reveals & enforces 8-char password policy on the login form             |
| F3  | 🟠  | Sign-up    | Submit gives no feedback; needed a second click (see F16)               |
| F4  | 🟡  | Sign-up    | Password policy is length-only (≥8), accepts `12345678`                 |
| F5  | 🟡  | Routing    | Unknown routes bounce anon users to `/sign-in` (no 404 when logged out) |
| F6  | 🟠  | Notes      | Control char in title → opaque "Failed to create note" (see F18)        |
| F7  | 🟠  | Notes      | New-user trap: subject defaults to "Existing → None", first note fails  |
| F8  | 🔵  | Notes      | UI collapses distinct failures into one generic string (API doesn't)    |
| F9  | 🟠  | Cards      | Over-length card question fails silently (no error, no card)            |
| F10 | 🟠  | Review     | Can grade a card without revealing the answer                           |
| F11 | 🟠  | Search     | `' OR 1=1 --` crashes the notes page with an unhandled 500              |
| F12 | 🟡  | Search     | `%`/`_` treated as `LIKE` wildcards, not literals                       |
| F13 | 🟡  | Notes list | Note rows are `<a>` with nested `<button>`s (invalid HTML)              |
| F14 | 🟡  | A11y       | Mobile menu dialog missing `aria-describedby` (console warning)         |
| F15 | 🟡  | Routing    | Catch-all 404 is the bare default Next.js page (unstyled)               |
| F16 | 🟠  | Forms      | Save/Create needs two clicks, no first-click feedback (4 forms)         |
| F17 | 🟡  | Notes      | Note detail renders two `<h1>`s (title + markdown heading)              |
| F18 | 🟠  | API        | `POST /api/notes` null-byte title → unhandled **HTTP 500** (= F6 root)  |
| F19 | 🟡  | API        | `/api/skill` rejects valid Bearer token (session-only auth)             |
| F20 | 🟡  | Settings   | "Clear sample data" runs with zero visible feedback                     |
| F21 | 🟡  | Routing    | Two inconsistent 404 treatments (chrome'd vs bare)                      |

**Coverage:** every page (sign-in/up, reset, check-email, dashboard, notes list/detail/new/edit, import, subjects list/detail/new/edit, memory-cards list/detail/new/edit, review, settings, FAQ, 404), every dialog (welcome, menu, BYOK, link-to-note, all delete confirms, sample-wipe, account-delete, token-reveal, token-revoke, contact), full CRUD on all three entities, the review session, and all `/api/*` endpoints (auth, CRUD, validation, IDOR, methods).

---

## Findings

### Auth (sign-in)

**F1 — 🟠 Form-level auth error is not announced to screen readers**
On a failed login the message `Invalid login credentials` renders as a bare `<p class="text-destructive text-sm">` with **no `role="alert"` and no `aria-live`**. Sighted users see it; screen-reader users get nothing — the error is silent for them. It also never appears in the accessibility tree (confirmed: absent from the a11y snapshot, present only in the screenshot). Fix: wrap form-level errors in `role="alert"` / `aria-live="polite"`.

**F2 — 🟡 Sign-in form enforces & reveals the password policy**
Submitting a short password on the **sign-in** page shows `Password must be at least 8 characters`. Length policy is a sign-**up** concern; on sign-in you should just attempt auth. Minor: leaks the policy and adds a pointless client gate (an existing user with a <8-char legacy password could be blocked from even trying).

**Positives (sign-in):** empty submit is blocked with inline messages; `'; DROP TABLE users;--<script>alert(1)</script>` in the email is rejected as invalid (no XSS fired, no crash); failed login returns a **generic** message (no user-enumeration leak).

### Auth (sign-up)

**F3 — 🟠 Sign-up submit gives no feedback and needed a second click to proceed**
Filled valid email + strong password, clicked **Create account**. The page stayed on `/sign-up` with the form still populated, **no spinner / disabled button / toast / error** — for 30+ seconds (across a screenshot, console check, and two network checks). A **second** click on the same button then navigated to `/sign-up/check-email`. From a user's seat this reads as "the button is dead" → rage-click or abandon. Root cause not fully isolated (first action may have silently created the account while failing to redirect, or the submit never fired), but the **observable defect is the same: zero pending/feedback state on the submit button.** Compare the sign-in button, which also lacks a visible loading state. Fix: disable + spinner on the submit button while the action is pending; surface any action error.

**F4 — 🟡 Password policy is length-only (≥8), no complexity**
`1234567` rejected for length, but `12345678` (or `password`) would pass. Trivially weak passwords are accepted. Acceptable for an MVP, noted for completeness.

**Positives (sign-up):** check-email page is clear and correct; empty/short-password submits blocked inline; no account-created toast (matches intended design); a "Report a problem" mailto is present for stuck users.

### Route guards & public surfaces

**F5 — 🟡 Unknown routes redirect anon users to `/sign-in` (no real 404 for logged-out visitors)**
`/this-route-does-not-exist-chaos-123` → redirect to `/sign-in`, identical to hitting a protected route. A logged-out user who mistypes a URL or follows a dead link is told "log in" rather than "not found," which is misleading. (Need to re-check whether an authenticated user gets a proper 404 — see authed phase.)

**F15 — 🟡 The authenticated 404 page is the bare default Next.js page**
Logged-in, an unknown route (`/bogus-route-chaos-zzz`) renders Next's stock white _"404 — This page could not be found."_ — no app chrome, no dark theme, no nav, no "back to dashboard" link. Jarring against the rest of the app and leaves the user with only the browser back button. Fix: add an `app/not-found.tsx` styled to match.

**F14 — 🟡 Mobile menu dialog is missing a description for assistive tech**
Opening the mobile nav logs: `Warning: Missing 'Description' or 'aria-describedby={undefined}' for {DialogContent}` (Radix). The menu drawer has no accessible description. Low impact but it's a real a11y gap and the only console warning surfaced during normal use.

**Positives (route guards):** protected route `/subjects` correctly redirects to `/sign-in` when unauthenticated; reset-password returns a proper **non-enumerating** message — `If an account exists for that email, you'll receive a password-reset link shortly` — and, unlike sign-up, renders its success state inline with clear feedback.

### Note creation

**F6 — 🟠 A control character in the title silently fails with an opaque "Failed to create note"**
A null byte (`\x00`) in the note title makes the create action fail with a generic `Failed to create note` (shown both inline and as a toast) — no indication of _what_ is wrong. Root cause: Postgres `text` columns reject ` `; isolated by retrying with a valid subject (still failed) then removing the null byte (succeeded). The field happily accepts and displays the character, then the write dies server-side. Fix: strip/normalise control chars on input (or validate + give a specific message). Generic catch-all errors make this undiagnosable for a user.

**F7 — 🟠 New-user trap: first note fails because the subject defaults to "Existing → None"**
A fresh account has **zero subjects**, yet the note form defaults the Subject control to **"Existing subject" = "None"**. Title-required is validated client-side, but the empty subject is **not** — clicking _Create note_ just returns the same opaque `Failed to create note`. The user's very first action fails with no hint that they must switch to "New subject". Fix: default a zero-subject account to "New subject" mode, and validate subject client-side with a clear message instead of relying on a server reject.

**F8 — 🔵 Both note errors share one generic string**
The subject-missing case (F7) and the bad-character case (F6) are completely different failures but surface the identical `Failed to create note`. Distinct causes deserve distinct, actionable messages.

### Memory cards

**F9 — 🟠 An over-length card question fails silently — no error, no card**
Added a memory card with a ~262-char single-word question. Clicking **Add memory card** did nothing: no card appeared, no inline error, no toast, no console/network error surfaced. A short question (with XSS payload) added fine immediately after — so the differentiator is **length**: a server-side limit rejects the question, but the inline card form swallows the rejection. The user is left staring at a filled form that "won't submit" with no reason given. Fix: enforce the limit client-side with a visible message / char counter, and surface the action error in the inline form.

**Positives (memory cards):** empty question blocked with `Question is required`; a normal card with `<script>alert(1)</script>` in the question saved and renders the tag as inert literal text; AI generation without a key shows a clean "Bring your own API key → Connect OpenRouter" dialog rather than erroring.

### Review flow (spaced repetition)

**F10 — 🟠 You can grade a card without revealing the answer**
On the dashboard Memory Card Review widget the four rating buttons (Again/Hard/Good/Easy) are **active before "Show answer" is clicked**. Clicking _Good_ on a hidden-answer card was accepted: the card advanced, _Due today_ dropped 70→69, _Reviews (30d)_ went 172→173. This defeats the point of spaced repetition (recall, _then_ reveal, _then_ self-grade) and makes an accidental tap permanently reschedule a card. Fix: disable/hide the grade buttons until the answer is revealed.

**Positives (review):** **double-click on a rating button does NOT double-count** — a `dblclick` on _Good_ moved _Due_ by exactly −1 and _Reviews_ by +1, so the action is guarded against double-submission (a common bug this app gets right); FSRS intervals (1m/6m/10m/8d) render per-button; sample data loaded cleanly (streak, heatmap, due counts all populated).

### Settings

### Notes list & search

**F11 — 🟠 A search query can crash the whole notes page with a 500 (unhandled server error)**
Searching `' OR 1=1 --` in the notes search box reliably renders the full-page error boundary: **"This page couldn't load — A server error occurred. Reload to try again."** (digests `2607482106`, `3410419578` across runs — reproducible). The console shows _"An error occurred in the Server Components render"_ — the search runs server-side via `?q=`, throws, and is uncaught.

- **Not SQL injection** — a lone `'` returns 30 filtered notes correctly (input is parameterised). Isolation: `%`, `'`, `%'`, `a --`, `x OR y`, `1=1`, `' --`, `' OR 1=1` each return results/empty **gracefully**; only the full token combo `' OR 1=1 --` (with or without the leading `%`) crashes.
- **Likely cause:** the search feeds raw input to a Postgres text-search parser (`to_tsquery`/`websearch_to_tsquery`), which throws a _syntax error in tsquery_ on certain operator/`--` token combinations; the throw isn't caught. **This is reachable with ordinary coding-note searches** (SQL snippets with `--`, boolean `OR`, operators). Fix: use `plainto_tsquery`/`websearch_to_tsquery` defensively and/or wrap the search query in a try/catch that returns empty results instead of throwing.

**F12 — 🟡 Search treats `%` and `_` as SQL `LIKE` wildcards instead of literals**
Searching `%` returns **all 52 notes** (it's an unescaped `LIKE` wildcard); `_` would match any single character. A user searching for a literal `%` (common in code: `%s`, `%d`, format strings) gets wrong results. Fix: escape `%` and `_` in the `ilike` value.

**F13 — 🟡 Note rows are `<a>` elements containing nested `<button>`s (invalid HTML)**
Each note card in the list is `<a href="/notes/…">` with two nested `<button>`s (Edit, Delete) inside it — confirmed via DOM (`interactiveDescendants: 2`). Interactive content nested in an anchor is invalid HTML and a hydration risk; it also makes the row's accessible name read as one run-on link — _"6/11/2026 I/O Edit Delete Python — Functional Programming"_ — mixing the link target with the button labels. Behaviour is fine (the buttons `stopPropagation`, so clicking Delete opens the confirm dialog rather than navigating), but the markup should restructure so the buttons are siblings of the link, not descendants.

**Positives (notes list):** Delete is **confirmation-gated** ("This permanently deletes the note and its memory cards. This can't be undone." → Cancel / Delete) and the Delete click correctly does **not** trigger the row navigation; `'` in search is safely parameterised (no SQL injection); empty result shows a clean "No notes match your search."

### Settings

**Positives (settings):** Daily-goal validates **both** bounds (`Goal must be at least 1`, `Goal must be 500 or fewer`); **Load sample data is password-gated** — "Wipe and load" stays disabled until a password is entered, a **wrong** password is rejected inline with `Incorrect password` and does NOT wipe data, correct password performs the destructive replace. Destructive-action re-auth is done right here (contrast the silent failures elsewhere).

### Notes (security)

**Positives (notes):** XSS is sanitised end-to-end — `<script>`, `javascript:` link hrefs (rewritten to `href=""`), and `![img](… onerror=…)` payloads all render as inert literal text in the live Preview, the saved note view, and `<b>XSS</b>` in the title shows as text (not bolded); emoji + CJK + em-dash all persist correctly; markdown tables / code blocks / lists render fine on mobile.

---

## Test log

_(chronological)_

1. Loaded `/` → redirected to `/sign-in`. Card is vertically centered; large empty black area above it on mobile (cosmetic).
2. Empty submit → inline `Enter a valid email address` + `Password must be at least 8 characters`. ✅
3. Injection string in email + `short` password → blocked by validation, no XSS. ✅
4. `nonexistent-chaos-xyz@bayalab.com` + wrong pw → `Invalid login credentials` (generic, inline, red). ✅ security / ❌ a11y (F1).
5. Sign-up empty + short-pw → blocked inline. Real account `ka@bayalab.com` + strong pw → **first click did nothing** (F3); second click → `/sign-up/check-email`.
6. Email confirmation link (provided by user) → `/dashboard`, Welcome dialog → Escape closes it. ✅
7. New note: empty → `Title is required`; null-byte/XSS title + subject "None" → `Failed to create note` (F6/F7/F8); XSS preview + saved view fully sanitised (F-positives); clean title → created OK.
8. Memory card: empty → `Question is required`; 262-char question → silent no-op (F9); short XSS question → saved, script inert.
9. Mobile menu opens (Dashboard/Notes/Cards/Subjects/FAQ/Settings/Connect/Sign out); Radix `aria-describedby` warning (F14).
10. Settings: daily goal -999 → "at least 1"; 999999999 → "500 or fewer"; sample-data load is password-gated, wrong pw → `Incorrect password`, correct pw → wiped + loaded.
11. Dashboard review: graded a hidden-answer card (F10); double-click did not double-count (✅). Authed 404 is bare default page (F15).
12. Notes list: Delete → confirm dialog, no row-nav (✅); rows are `<a>` with nested `<button>`s (F13).
13. Search: `' OR 1=1 --` → reproducible 500 crash (F11); `%` → all 52 (wildcard, F12); `'` → 30 filtered (no injection, ✅); subsets isolated.

---

## Deep audit — round 2 (full CRUD, every page/dialog, all endpoints)

> Second pass after round 1 sampled surfaces. Goal: exercise every feature to completion.

### Subjects — full CRUD

**F16 — 🟠 Edit-subject "Save changes" requires two clicks / gives no feedback on the first (same systemic gap as F3)**
Renamed a subject, clicked **Save changes**: the inline form stayed open, the `<h1>` heading kept the **old** title, no toast/spinner — even after a 2s wait. A **second** click on Save then navigated off `?edit` and the heading showed the new title. This reproduces the sign-up double-click (F3) on a _second, unrelated_ server-action form, confirming it's **systemic**: server-action submits don't reliably reflect success on the first click (no pending state, no refresh, no toast). The recent commit history ("double-fired action toast", "useActionTransition") shows this area is fragile. Fix once, centrally, in the shared action/transition hook: pending state on the button + refresh/redirect (or toast) on resolve.

### Notes / Cards — full CRUD (round 2)

**F16 (extended) — 🟠 The two-click/no-feedback Save affects subject-edit AND card-edit, but NOT note-edit**
Confirmed the same defect on **card-edit** (`/memory-cards/:id/edit`): after Save changes the page sat still for 2s+ with no toast/redirect; a second click navigated to `/memory-cards` and the edit had persisted. **Note-edit, by contrast, redirected correctly on the first click.** So three edit forms, two behaviours — the inconsistency itself is a bug: the shared action/transition handling isn't applied uniformly. Subject-edit + card-edit need the fix; note-edit shows the correct pattern to copy.

**F17 — 🟡 Note detail renders two `<h1>`s**
The note view shows the note title as `<h1>` and _also_ renders the markdown body's leading `# Heading` as a second `<h1>` (e.g. title "Imperative programming [EDITED ✏️]" + body H1 "Imperative (procedural) programming"). Two top-level headings per page is an a11y/SEO smell and visually redundant (the heading is shown twice). Consider demoting rendered markdown headings by one level, or stripping a leading H1 that duplicates the title.

**Positives (notes/cards CRUD):** note-edit persists first-click; **note delete cascades to its cards** (confirmed: deleting a 3-card note dropped the card count 69→66) behind a clear confirm dialog ("permanently deletes the note and its memory cards"); card **edit/unlink/link/delete** all work — unlink is instant + non-destructive (card survives as standalone and gains a **Link** action), **Link-to-a-note** dialog cascades subject→note with the Link button disabled until both are chosen, card delete is confirm-gated ("deletes the memory card and its review history"); the memory-cards list page is solid (by-state + by-maturity charts, subject/state/maturity filters, inline review); **standalone card create** (`/memory-cards/new`) works first-click with an optional "Add code context" markdown editor; the **review session** is correct — `Show answer` reveals via accordion, grading (tested `Easy`) advances to the next card, decrements _cards due_ (67→66), and re-collapses the answer; FSRS intervals (1m/6m/10m/8d) render per grade; **Import** live-splits pasted markdown on H1/H2/H3 into editable/skippable notes (pre-heading text → an "Untitled" note), committed first-click into a new subject, titles XSS-safe.

### Subjects — full CRUD (round 2)

**Positives (subjects):** Create validates `Title is required` and **trims whitespace-only** titles; title/description XSS render as inert literal text (`<script>`, `<b>` shown as text) in heading, combobox, and toast; **delete-subject is confirmation-gated and explicitly non-destructive to notes** — "This deletes the subject only. Its notes are kept and become unassigned — nothing is lost." — and the delete completed on the first click; edit validates empty title.

### Settings — every section + dialog

**F16 (further confirmed) — 🟠 CLI-token "Create token" also needs two clicks**
First click on **Create token** left "No tokens yet" with no feedback; the second click created the token and showed the once-only reveal dialog. **Crucially, only ONE token existed afterward** — the swallowed first click did not create a duplicate (good — a double-mint would be a security/clutter problem). Still, this is the **third** form exhibiting F16 (subject-edit, card-edit, token-create), cementing it as a shared-hook defect rather than a per-form fluke.

**F20 — 🟡 "Clear sample data" runs with zero visible feedback**
Clicking **Clear sample data** showed no dialog, toast, or spinner — twice. Only an API query confirmed it had actually run. It is **correctly scoped** (it removed the seeded "Python — Functional Programming" subject + its ~50 notes / ~60 cards but **preserved my own created content** — the Imported Chaos subject, imported notes, and standalone card), so skipping a confirm dialog is defensible — but the total absence of a "cleared" confirmation leaves the user unsure whether anything happened (same feedback-gap family as F16).

**Positives (settings) — extensive and strong:**

- **Daily goal** validates both bounds (`≥1`, `≤500`) — round 1.
- **CLI tokens**: name required; token **shown once** with a clear "copy it now, can't be retrieved" warning; **usage tracking works** (row updated from "never used" → "last used 6/11/2026" after my API calls); **Revoke is confirm-gated** ("any agent or script using it will immediately stop working") and **takes effect instantly** — the revoked token returned `401 "Invalid, expired, or revoked token"` on the very next API call (verified end-to-end).
- **Connect OpenRouter** uses proper **OAuth + PKCE (`code_challenge_method=S256`)** to `openrouter.ai` with callback `/api/openrouter/callback` — no client secret exposed.
- **Delete account** is the **strongest-gated action in the app**: a **double gate** requiring you to type `DELETE` (case-sensitive — lowercase `delete` keeps the button disabled) **and** your current password, button disabled until both are satisfied.
- **Load sample data** is password-gated with wrong-password rejection (round 1).

### HTTP API endpoints (token API — `/api/{notes,subjects,memory-cards,skill}`)

Tested with a real `clc_…` CLI token minted from Settings.

**F18 — 🟠 `POST /api/notes` with a control char in the title returns HTTP 500 — confirms F6 is a server-side core bug**
A null byte (` `) in the note title passes Zod validation (Zod `string()` accepts control chars) then dies at the Postgres `text` write, returning **`500 {"error":"Failed to create note"}`** — an unhandled server error reachable by any token holder, not just the UI. This proves **F6 is not a UI bug but a flaw in the shared `*-core` create path**: nothing strips/rejects Postgres-invalid characters before the insert. Fixing it in the shared Zod schema (reject/strip ` ` and other control chars) closes both the UI (F6) and the API (F18) at once. Every other invalid input the API handled with a clean `400` — this is the one that 500s.

**F19 — 🟡 `/api/skill` rejects a valid Bearer token (session-cookie auth only) — inconsistent with the rest of the API**
`GET /api/skill` returns `401 {"error":"Not authenticated"}` **even with a valid `clc_` token**, while `/api/{notes,subjects,memory-cards}` accept the same token. It's cookie/session-gated (the in-app "Download agent skill" link works because the browser is logged in). Defensible (skill download is a browser action), but the split is undocumented and the differing 401 message (`"Not authenticated"` vs `"Missing or malformed Authorization header"`) hints at two separate auth middlewares — an agent told to "use your token against the API" will be confused that one endpoint refuses it.

**Positives (API) — strong:** auth returns **401 for no-auth, bad token, and malformed `Authorization` header**, all with clean non-leaking bodies; **IDOR-safe** — `GET`/`PATCH`/`DELETE` on another user's UUID returns `404 "Subject not found"` (RLS scoping, and 404-not-403 avoids existence disclosure); writes return correct codes (`POST`→201, `PATCH`→200, `DELETE`→200, missing→404); **validation is excellent and beats the UI** — malformed JSON → `400 "Request body must be valid JSON"`, missing fields → Zod `400`s, over-length → `400 "Title must be 200 characters or fewer"`, a **1 MB body** is rejected `400` (no crash); unsupported methods → `405`; subject delete correctly **nulls** linked notes' `subject_id` (matches the UI's "notes become unassigned"). The token API is the most robust surface in the app — ironic given the UI swallows the very errors the API reports clearly.

### Remaining pages + cross-cutting

**F21 — 🟡 Two different 404 experiences (inconsistent)**
A not-found **resource** (`/notes/<unowned-uuid>`) renders a 404 **with app chrome** (Notes header + footer), but a not-found **route** (`/bogus-route`, F15) renders the **bare** white Next.js 404. Same status, two visual treatments. Pick one styled `not-found.tsx`.

**Positives (cross-cutting):**

- **FAQ** is well-structured (About / AI / CLI API / Your data / Help accordions) and its **API endpoint table is accurate and in-sync** with the real API I tested — correct methods/paths and the exact unfile-vs-cascade semantics (`DELETE /api/subjects/{id}` → notes/cards unfiled; `DELETE /api/notes/{id}` → cards deleted). No drift (a real risk this app flagged for itself).
- **Contact** dialog validates (`Subject is required`) and a real submission **sent successfully** (dialog closed, no console errors) — the **prod SMTP path works end-to-end: delivery confirmed by the admin receiving the test email** (`EMAIL_HOST`/`EMAIL_TO` prod env wired correctly).
- **IDOR-safe in the browser** too: deep-linking `/notes/<unowned-uuid>` returns 404 (RLS), matching the API.
- The AI-features FAQ correctly describes the security model (BYOK, server-side, encrypted at rest, preview-gated).

## Test environment notes

- All interaction via Playwright MCP at a fixed 390×844 mobile viewport against the **live production deploy** (no local build).
- 23 screenshots saved alongside this report in `./screenshots/chaos-01..23-*.png` (sign-in, failed-login, check-email, reset-pw, dashboard, note preview/view, long card, mobile menu, daily-goal, sample-data dialogs, review widget, 404, search crash/wildcard isolation).
- The test account `ka@bayalab.com` is **still active and not torn down** — available for follow-up verification of fixes. State after the audit: the seeded "Python — Functional Programming" sample data was cleared (F20 test); what remains is the audit-created "Imported Chaos" subject + its imported notes and one standalone card. The `chaos-audit-token` CLI token was **revoked** at the end. Daily goal reset to 5.
- Round 2 also used `curl` against the live `/api/*` endpoints with a real (now-revoked) CLI token; payloads in `/tmp/*.json`.
