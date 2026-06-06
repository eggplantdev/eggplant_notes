# Simplification & Dedup Proposals

> Audit started 2026-06-06 (parallel scan of `src/` across five clusters: delete/dialog
> patterns, forms + action-wrappers, queries/types/promotion, module cohesion, list/page
> scaffolding). **Section A is partially implemented** — see Handoff. Every item quotes real
> code; **line numbers predate the implemented changes and may be stale — re-grep before trusting them.**

## Handoff — next session

**Shipped so far (all `pnpm typecheck` + `lint` green; E2E not run — needs local Supabase):**

- **A1 `CardActions`** ✅ `4201c90`. Went further than proposed: the three `*-card-actions.tsx`
  wrappers were **inlined into their lists and deleted** (not kept as 4-line wrappers). `CardActions`
  lives in `components/ui/`; lists call it directly in `renderAction`. Memory-cards passes
  `deleteControl` instead of `onRequestDelete`.
- **A2 `useDeleteDialogState`** ✅ `4201c90`. Hook at `src/hooks/use-delete-dialog-state.ts`; notes +
  subjects lists use it.
- **A5 `EmptyState`** ✅ `d49bf7c` (committed by a parallel session). `components/ui/empty-state.tsx`;
  applied to notes/subjects/memory-cards/subject-detail pages.
- **`MutedText`** ✅ `bd1d08d` — _not in the original findings_; emerged mid-session. Shared muted
  secondary-text primitive (`components/ui/muted-text.tsx`) for subjects list/detail, the review
  card's "From:" link, and the dashboard "needs attention" rows. `asChild` merges onto a `<Link>`;
  self-nullifies on empty content.
- **Comment discipline** ✅ `1451a89` + global rule. Stripped redundant doc-headers from the type
  files; added a comment rule to `~/.claude/rules/general.md` (Code Changes) — comment only
  non-derivable info; redundant comments may be removed. (The rule file is outside this repo.)

**Decisions made (carry forward):**

- **Single-consumer pass-through wrappers get inlined, not kept.** That's why A1's wrappers were
  deleted. Apply the same lens to **A3** (the two delete-dialog wrappers) and **A4** — prefer
  inlining/sharing over a named wrapper unless a 2nd real consumer exists.
- A2 + the inline decision make **A4** (delete-button unification) the natural next delete-path step,
  but A4 touches account-delete's type-to-confirm gate → medium risk, test it.

**Environment hazard (important):** multiple agent sessions run against this one working tree and
**share the git identity (`ex-Plant`)**. Always stage by **explicit path**, never `git add -A`. As of
this writing a `CardsOverview` / `state-breakdown` refactor is in-flight uncommitted by another
session — leave it alone.

**Suggested next pickups:** remaining quick-wins — **D1** (split toast layer), **B3** (`useFormSubmit`),
**C1** (`runTableSingleQuery`), **D2** (split `heatmap-view.ts`). All S/Low. Then A3/A4 per the
inline-over-wrap decision. Defer B1→B2 (action-wrapper unification, test-heavy); confirm intent on
C2 before demoting `ActivityDayT`.

---

## How to read this

- **Effort:** S (≤30 min) · M (30–60 min) · L (>60 min / multi-file).
- **Risk:** chance of behavior change / hard-to-test surface.
- Items are grouped by theme; the ranked quick-win list is at the bottom.

---

## A. Component & UI duplication (highest leverage, lowest risk)

### A1. Card-action button pairs are ~95% identical → extract `CardActions` ✅ DONE (`4201c90`)

> Implemented and went further: wrappers inlined into the lists and deleted. See Handoff.

**Files:** `features/notes/components/note-card-actions.tsx:16-29`,
`features/subjects/components/subject-card-actions.tsx:17-34`,
`features/memory-cards/components/memory-card-actions.tsx:16-31`

All three render the same `<div className="flex items-center gap-2">` + outline "Edit"
(router.push to an href) + destructive "Delete" (calls `onRequestDelete`). The only real
difference is the edit href:

- notes → `/notes/${id}?edit=note`
- subjects → `/subjects/${id}?edit`
- memory-cards → `memoryCardEditHref(noteId, checkId)`

**Proposal:** generic `CardActions` in `src/components/ui/card-actions.tsx`:

```tsx
type CardActionsPropsT = {
  editHref: string
  onRequestDelete: () => void
  editLabel?: string
  deleteLabel?: string
}
```

Each feature keeps a 4-line wrapper that only supplies its href + delete callback.
**Effort:** S · **Risk:** Low.

### A2. Per-list pending-delete state is duplicated verbatim → extract `useDeleteDialogState` ✅ DONE (`4201c90`)

**Files:** `features/notes/components/notes-list.tsx:20-22,46-50`,
`features/subjects/components/subjects-list.tsx:17-46`

Both lists hold:

```tsx
const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
const openId =
  pendingDeleteId && items.some((i) => i.id === pendingDeleteId) ? pendingDeleteId : null
// ...onOpenChange={(open) => { if (!open) setPendingDeleteId(null) }}
```

(The "openId derives from presence in the list so it self-closes on revalidation" trick is
identical and load-bearing — preserve it in the hook.)

**Proposal:** `useDeleteDialogState<T extends {id:string}>(items): { openId, requestDelete, onOpenChange }`.
Lives at `src/hooks/use-delete-dialog-state.ts`. Each list drops to one hook call + its own
`Delete*Dialog`.
**Effort:** S · **Risk:** Very low (pure state extraction).

### A3. The two delete-dialog wrappers are ~90% identical → share via the same hook

**Files:** `features/notes/delete-note-dialog.tsx:23-38`,
`features/subjects/delete-subject-dialog.tsx:20-35`

Identical structure; differ only in id prop name, copy strings, and the bound action.
A small `useActionTransition`-backed helper (`useDeleteConfirm(action, redirectTo)`)
collapses the body to `<ConfirmDeleteDialog {...} />` with feature copy passed in.
**Effort:** S · **Risk:** Low.

### A4. Three different "delete button + confirm" patterns coexist → unify

**Files:** `features/notes/delete-note-button.tsx`, `features/subjects/delete-subject-button.tsx`
(delegate to a dialog wrapper), vs `features/memory-cards/delete-memory-card-button.tsx:18-40`
and `features/account/components/delete-account-dialog.tsx:19-59` (own
`useActionTransition` + `ConfirmDeleteDialog` inline).

The notes/subjects path and the memory-card/account path solve the same problem two ways.
After A3's `useDeleteConfirm` exists, fold the inline pair into it (account keeps its extra
type-to-confirm gate as a prop).
**Effort:** M · **Risk:** Medium (touches account-delete; test the confirm gate).

### A5. Empty-state markup repeated across pages → extract `EmptyState` ✅ DONE (`d49bf7c`)

**Files:** `app/(protected)/notes/page.tsx:44-56`, `subjects/page.tsx:26-35`,
`memory-cards/page.tsx:40-52`, `subjects/[id]/page.tsx:45-50`

Same `rounded-lg border border-dashed p-8 text-muted-foreground` block, sometimes with a
`flex flex-col items-start gap-3` + CTA `<Button asChild><Link/></Button>`.

**Proposal:** `EmptyState` in `src/components/ui/empty-state.tsx` with `title`, optional
`action: { label, href }`. Pages pass copy only.
**Effort:** S · **Risk:** Low.

### A6. `MemoryCardsSection` hand-rolls a list that duplicates the card pattern

**File:** `features/memory-cards/memory-cards-section.tsx:40-72`

Inline `checks.length === 0 ? <p/> : <ul>…map…</ul>` with per-row Edit `<Link>` +
`DeleteMemoryCardButton`, separate from the global `MemoryCardsList`/`AnimatedCardList`
path. Extract a `CheckList` (feature-local: `features/memory-cards/components/check-list.tsx`)
so the note-detail and global views share row markup + empty copy.
**Effort:** S · **Risk:** Low.

### A7 (optional). Page-header + section scaffolds

- **`SettingSection`** — `settings/page.tsx:13-31` has two near-identical `<section>` panels
  (the second adds `border-destructive/30` + `text-destructive`). Extract with an `isDanger` flag. **S / very low.**
- **`PageHeader` prop-factory** — notes/subjects/memory-cards pages repeat
  `title + pluralize(count, label) + "New X" button`. A factory returning PageShell props
  is a mild win; lower priority since `PageShell` already carries the weight. **S / low.**
- **`PanelGrid`** for the dashboard's four `TitledCard`s (`dashboard/page.tsx:85-129`) —
  marginal; the page is already readable. **Skip unless it grows.**

### A8. `MutedText` muted-secondary-text primitive ✅ DONE (`bd1d08d`)

Not in the original findings; surfaced mid-session. The `text-muted-foreground` + size +
clamp/truncate treatment was hand-rolled (and drifting) across the subjects list/detail, the
review card's "From:" link, and the dashboard "needs attention" rows. Extracted to
`components/ui/muted-text.tsx` (`asChild` to merge onto a `<Link>`; self-nullifies on empty).

---

## B. Server-action / forms plumbing

### B1. `runAuthAction` and `runTableAction` are the same skeleton → consider a shared core

**Files:** `features/auth/run-auth-action.ts:13-26`, `lib/supabase/run-table-action.ts:19-34`

Both: `validateInput` → early-return on failure → `createClient()` → run `call` → normalize
`{ error }`. They differ only in the return payload (`ActionResultT` with no data vs
`TableActionResultT<TRow>` with the affected row) and that the table one logs.

**Note the existing rationale** (both files document it): the split mirrors throws-vs-returns
semantics and keeps auth dependency-free. So treat this as a _judgment call_, not a slam-dunk.
A `runServerAction` core with two thin typed wrappers removes the body duplication while
keeping both public signatures intact (zero churn in the 10+ callers).
**Effort:** M · **Risk:** Medium (critical path — test every action type).

### B2. RPC mutations re-implement the error envelope by hand → `runRpcAction`

**Files:** `features/notes/actions/create-note.ts:22-39`,
`features/account/actions/delete-account.ts:11-18`,
`features/review/actions/rate-memory-card.ts:23-76`

These bypass `runTableAction` (no `.select().single()` on an RPC) and re-do
validate → `.rpc()` → check `.error` → `{ success:false, error }`. A `runRpcAction`
wrapper in `lib/supabase/` removes the repetition. `rateMemoryCard` keeps its
server-side FSRS compute outside the wrapper.
**Effort:** M–L · **Risk:** Medium (`rateMemoryCard` is the complex one).

### B3. Form submit boilerplate repeated 4× → `useFormSubmit`

**Files:** `note-form.tsx:60,93-94`, `subject-form.tsx:25,34`,
`memory-card-form.tsx:36,48-51`, `daily-goal-form.tsx:19,25-27`

Every form: `const result = await action(); if (!toastActionResult(result)) setFormError(result.error)`
plus optional on-success cleanup. Extract a hook owning `formError` + the toast/error
dance, taking an `onSuccess` callback. Lives in `components/forms/hooks/`.
**Effort:** S–M · **Risk:** Low.

### B4. Create-vs-edit form prop unions repeated → shared `CreateOrEditFormPropsT<TEntity,TInput>`

**Files:** `note-form.tsx:37-48`, `subject-form.tsx:19-21`, `memory-card-form.tsx:28-32`

Each form re-declares the same discriminated union (entity present ⇒ edit, takes
`(id, input)`; absent ⇒ create, takes `input`). Factor the type into
`components/forms/types/form-types.ts`.
**Effort:** M · **Risk:** Low (types only).

---

## C. Queries / types / promotion

### C1. Identical `maybeSingle()` + error-handling in 2 reads → `runTableSingleQuery`

**Files:** `features/notes/queries.ts:44-55` (`getNote`),
`features/subjects/queries.ts:22-33` (`getSubject`)

Same `maybeSingle()` → `if (error) { console.error; throw }` → `return data ?? undefined`.
(`settings/queries.ts:11-19` is the same shape but applies a default — leave inline.)
Extract a sibling to `runTableQuery` in `lib/supabase/`.
**Effort:** M · **Risk:** Low.

### C2. `ActivityDayT` is over-promoted to `src/types` (1 real consumer)

**File:** `src/types/activity.ts:1-5`

Produced by `review-events`, consumed only by `dashboard`. Per the project's own
"promote on the 2nd _consumer_" rule, a producer + single consumer doesn't meet the bar.
Demote to `features/dashboard/types.ts` (or export from `review-events`). 3 import updates.
**Effort:** S · **Risk:** Low. _(Confirm intent — borderline, and the comment claims it was deliberate.)_

### C3. `TableActionResultT<T>` is exported but only used internally

**File:** `lib/supabase/run-table-action.ts:9`

Callers always unwrap it to `ActionResultT`. Either stop exporting it or rename to signal
internal use, so it stops looking like a public alternative to `ActionResultT`.
**Effort:** S · **Risk:** Low.

### C4. `CheckStatRowT` (dashboard) mirrors the column list in `memory-cards/queries.ts:44`

**Files:** `features/dashboard/types.ts:26-34`, `features/memory-cards/queries.ts:44`

The structural row type is hand-kept in sync with the `select(...)` string. Gray area:
either export the type from `memory-cards` as the single source, or leave it as a
dashboard-owned aggregation contract. Flag, don't force.
**Effort:** S · **Risk:** Low.

> **Verified correct, no action:** `NoteT`/`SubjectT`/`MemoryCardT`/`ReviewEventT` promotions
> (2+ consumers, real DB rows), all dashboard aggregation + heatmap UI types kept local,
> `RateResultT` local to review, `getCurrentUser` correctly centralized via `cache()`.

---

## D. Module cohesion (split grab-bag files)

### D1. The toast layer mixes config + domain logic across 5 files

**Files:** `components/toasts.ts:37-40` (react-toastify wrapper **and** `toastResult` domain
routing **and** `ToastType`/`ToastPosition` types), plus `toast-messages.ts`,
`action-toast.tsx`, `toast-provider.tsx`, `forms/toast-result.ts`.

`toasts.ts` carries three concerns. **Proposal:** keep `toasts.ts` as the toastify wrapper
only; move types → `toast-types.ts`, `toastResult` → `toast-utils.ts`. Registry/provider
files are fine as-is.
**Effort:** S · **Risk:** Low (tests exist for `toast-result`).

### D2. `heatmap-view.ts` mixes geometry constants with a formatter

**File:** `features/dashboard/heatmap-view.ts` — exports `CELL`/`GAP` (px geometry) **and**
`formatCellLabel()` (presentation text). Split into `heatmap-geometry.ts` + a label file.
**Effort:** S · **Risk:** Low.

### D3. UI component files export a type alongside the component

**Files:** `components/ui/goal-progress-bar.tsx` (`GoalBarVariantT`),
`components/ui/combobox.tsx` (`ComboboxOptionT`), `components/ui/multi-select.tsx`

Mild violation of "component file exports only the component." The types are integral to
each component's API, so this is low priority — move to a `components/ui/types.ts` barrel
only if you want strict compliance.
**Effort:** S · **Risk:** Very low.

### D4. `features/memory-cards/utils/index.ts` is a value-free re-export barrel

Two unrelated functions re-exported. Either delete and import directly, or keep and
document why the barrel shields the `utils/` layout. **S / low.**

> **Confirmed clean:** markdown/, motion/, forms/ structure, dashboard split (except D2),
> `nav-items.ts`, `grades.ts` (deliberately data-only, no ts-fsrs import),
> `review-celebration-context.tsx` (provider+hook pairing is correct).

---

## Ranked quick-wins (do these first)

| #   | Item                            | Effort | Risk  | Status / why                               |
| --- | ------------------------------- | ------ | ----- | ------------------------------------------ |
| 1   | A1 `CardActions` component      | S      | Low   | ✅ done `4201c90` (wrappers inlined)       |
| 2   | A2 `useDeleteDialogState` hook  | S      | V.Low | ✅ done `4201c90`                          |
| 3   | A5 `EmptyState` component       | S      | Low   | ✅ done `d49bf7c`                          |
| —   | A8 `MutedText` (bonus)          | S      | Low   | ✅ done `bd1d08d`                          |
| 4   | D1 split toast layer            | S      | Low   | next — most-cited cohesion smell           |
| 5   | B3 `useFormSubmit` hook         | S–M    | Low   | next — 4 forms, removes submit boilerplate |
| 6   | A3 share delete-dialog wrappers | S      | Low   | next — but see inline-over-wrap decision   |
| 7   | C1 `runTableSingleQuery`        | M      | Low   | next — removes read-path dup               |
| 8   | D2 split `heatmap-view.ts`      | S      | Low   | next — trivial cohesion fix                |

**Defer / judgment-call:** B1 (unify action wrappers — documented split, test-heavy),
B2 (`runRpcAction` — do after B1), A4 (delete-button unification — touches account delete),
C2 (`ActivityDayT` demote — confirm intent first). **Skip:** A7 `PanelGrid`.

## Cross-cutting note

Several items chain: **A2 + A3** enable a cleaner **A4**; **B1** should land before **B2**;
**A1/A5/D1** are independent and safe to do immediately. Estimated total for the ranked
quick-wins: ~3–4 h, ~150 lines of duplication removed, no behavior change if each lands
with its existing tests green.
