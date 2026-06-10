# Subject Switcher in Detail View — Implementation Plan

## Overview

Collapse the standalone `/subjects` card list into the single-subject detail view. A subject
**switcher** (a `Combobox` navigation control) at the top of the detail view replaces the list as the
way to move between subjects; creating, editing, and deleting subjects all happen from this one screen.
`/subjects` stops being a list and becomes a redirect into the detail view.

## Current State Analysis

- **`/subjects` listing** (`src/app/(protected)/subjects/page.tsx`) renders `SubjectsList` — subjects as
  clickable cards (title + description + edit/delete) — plus `SearchFilterInput` and `PaginationFooter`.
- **Detail view** is a layout + nested segment:
  - `src/app/(protected)/subjects/[id]/layout.tsx` — `PageShell` (title = subject name; `backHref`
    `/subjects`; `actions` = New note / Edit / Delete) wrapping a two-pane grid: `SubjectNoteSidebar`
    (notes list, dnd reorder, mobile sheet) + content pane (`children` = active `[noteId]`).
  - `src/app/(protected)/subjects/[id]/page.tsx` — `?edit` renders the subject edit form; otherwise
    redirects to the first note or shows an empty state.
- **`PageShell`** (`src/components/layout/page-shell.tsx:90-99`) renders `eyebrow` above the `<h1>`,
  `subtitle` below it, `actions` on the right. `title` is typed `string` (not `ReactNode`).
- **`Combobox`** (`src/components/ui/combobox.tsx`) takes `options` (`{value,label}[]`), `value`,
  `onChange(value)`, `searchPlaceholder`, `emptyMessage`, `className`, `disabled`. Built-in search.
- **`getSubjects()`** (`src/features/subjects/queries.ts:22`) already returns the full unpaginated
  `{id,title}` set used by the form selects — the switcher reuses it, no new query.

### Key Discoveries:

- `create-subject` already `toastRedirect`s to `/subjects/${result.id}` (`actions/create-subject.ts`) —
  so the "New subject" button (→ `/subjects/new`) lands the user directly on the new subject. No change.
- `delete-subject` already `toastRedirect`s to `/subjects` (`actions/delete-subject.ts`) — once
  `/subjects` redirects into the detail view, deleting a subject auto-lands on the next subject for free.
- `subject-filter.tsx` is used by `/notes` and `/memory-cards` (not the subjects list) — **keep it**.
- `SubjectNoteSidebar` returns a fragment of two responsive siblings (desktop `<nav>` + mobile sheet
  `<div>`); the desktop nav relies on being a grid cell with `md:min-h-0 md:overflow-y-auto` to scroll
  independently. Wrapping it to add a sibling button must preserve that scroll containment.

## Desired End State

Visiting any subject shows, at the top: a switcher reading the current subject (pick another → navigate)
plus a "New subject" button. The header's right side carries "Edit subject" / "Delete subject". An
"Add note to this subject" button sits at the top of the notes column. `/subjects` redirects to the
first subject (or, with zero subjects, shows an empty state offering to create one). The old card list,
its query, and its row type no longer exist. Verify: `pnpm typecheck`, `pnpm lint`, `pnpm build` pass;
click-through matches the above.

## What We're NOT Doing

- Not changing the two-pane note layout, the note sidebar's dnd reorder, or the `[noteId]` content pane.
- Not changing `PageShell` (switcher goes in `eyebrow`, Design A — `title` stays `string`).
- Not changing `/subjects/new`, the subject create/edit forms, or any subject query other than removing
  the now-dead `getSubjectsList`.
- Not removing `SearchFilterInput` / `PaginationFooter` (other pages use them).
- Not touching `subject-filter.tsx` (used by `/notes` + `/memory-cards`).
- Not adding pagination/search to the switcher beyond the `Combobox`'s built-in search.

## Implementation Approach

Two phases. Phase 1 builds the new switcher and rewires the detail header — an intermediate state where
both the new switcher and the old `/subjects` list coexist and work. Phase 2 collapses `/subjects` into a
redirect and deletes the now-dead listing code. Splitting this way keeps each phase independently
verifiable and leaves no broken intermediate.

## Critical Implementation Details

- **Scroll containment when adding the add-note button** — the notes column's desktop `<nav>` scrolls
  via `md:min-h-0 md:overflow-y-auto` because it is a direct grid cell. Wrapping `SubjectNoteSidebar`
  with a sibling button means the wrapper becomes the grid cell; it must carry `md:flex md:flex-col
md:min-h-0`, the button stays fixed, and the sidebar's nav keeps `md:flex-1 md:min-h-0` so only the
  list scrolls — the page itself must still never scroll.
- **Switcher is a client component** — it uses `useRouter().push`. The detail `layout.tsx` is a server
  component that fetches `getSubjects()` and passes the list + current id down as props.

## Phase 1: Subject switcher + detail header rewire

### Overview

Add the switcher component and rewire the detail layout's header and notes column. `/subjects` still
shows the old list after this phase (removed in Phase 2).

### Changes Required:

#### 1. Subject switcher component

**File**: `src/features/subjects/components/subject-switcher.tsx` (new)

**Intent**: A client navigation control: a `Combobox` of all subjects, value bound to the current
subject; selecting another `router.push`es to that subject's detail. Replaces the list as the way to
move between subjects.

**Contract**: `function SubjectSwitcher({ subjects, currentId }: { subjects: SubjectOptionT[];
currentId: string })`. Maps `subjects` → `{value: id, label: title}`; `value={currentId}`;
`onChange={(id) => router.push(`/subjects/${id}`)}`. `'use client'`. No "New subject" item inside the
dropdown — that is a sibling button (next change).

#### 2. Detail layout header + notes column

**File**: `src/app/(protected)/subjects/[id]/layout.tsx`

**Intent**: Fetch the full subject list; render the switcher + a "New subject" button in the `eyebrow`
slot; relabel the subject actions; move the add-note action into the notes column with clearer copy;
drop the now-pointless back link.

**Contract**:

- Add `getSubjects()` to the existing `Promise.all` (alongside `getSubject` + `getSubjectNoteSummaries`).
- `PageShell`: remove `backHref`/`backLabel`; add `eyebrow={<div class="flex … gap-2"><SubjectSwitcher
subjects={all} currentId={id} /><ButtonLink href="/subjects/new" variant="outline" size="sm">New
subject</ButtonLink></div>}`. `title` stays `subject.title`.
- `actions`: drop the "New note" `ButtonLink`; relabel "Edit" → "Edit subject", and the
  `DeleteSubjectButton`'s label → "Delete subject" (pass through whatever label prop it exposes, else
  edit the button's text).
- Notes column (grid cell 1): wrap `SubjectNoteSidebar` so an `ButtonLink` ("Add note to this subject",
  → `/notes/new?subject=${id}`) sits above it; preserve scroll containment per Critical Implementation
  Details.

#### 3. Delete-subject button label

**File**: `src/features/subjects/components/delete-subject-button.tsx` (only if it hardcodes "Delete")

**Intent**: Surface "Delete subject" instead of bare "Delete".

**Contract**: If the label is hardcoded, change the visible text to "Delete subject" (keep the
confirmation dialog wiring intact). If it already accepts a label prop, pass it from the layout instead.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Production build compiles: `pnpm build`

#### Manual Verification:

- On a subject, the switcher shows the current subject; picking another navigates to it.
- "New subject" opens the create form; saving lands on the new subject.
- Header shows "Edit subject" / "Delete subject"; both still work (edit form, delete + redirect).
- "Add note to this subject" sits atop the notes list and opens the new-note form scoped to the subject.
- On desktop the notes list scrolls independently; the page itself does not scroll. Mobile: the notes
  sheet trigger and add-note button are both reachable.

**Implementation Note**: After Phase 1 automated checks pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Collapse the listing page + remove dead code

### Overview

Turn `/subjects` into a redirect and delete the listing-only code.

### Changes Required:

#### 1. `/subjects` becomes a redirect

**File**: `src/app/(protected)/subjects/page.tsx`

**Intent**: No longer a list. Redirect to the first subject's detail; with zero subjects, show an empty
state offering to create one.

**Contract**: Server component. Fetch subjects (`getSubjects()`); if non-empty, `redirect(`/subjects/${
first.id}`)`; if empty, render `PageShell` + `EmptyState` (message "No subjects yet.", action "Create
your first subject" → `/subjects/new`). Drop `SubjectsList`, `SearchFilterInput`, `PaginationFooter`,
pagination parsing, and the `getSubjectsList` call from this file.

#### 2. Remove dead listing code

**Files**:

- delete `src/features/subjects/components/subjects-list.tsx`
- `src/features/subjects/queries.ts` — remove `getSubjectsList`
- `src/features/subjects/types.ts` — remove `SubjectListItemT`

**Intent**: These existed only to serve the card list. Remove them once nothing imports them.

**Contract**: After deletion, `grep -r "SubjectsList\|getSubjectsList\|SubjectListItemT" src` returns no
hits. Keep `getSubjects`, `getSubject`, `getSubjectNoteSummaries`, `SubjectOptionT`,
`SubjectNoteSummaryT`.

### Success Criteria:

#### Automated Verification:

- No dangling references: `grep -rn "SubjectsList\|getSubjectsList\|SubjectListItemT" src` is empty.
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Production build compiles: `pnpm build`

#### Manual Verification:

- Visiting `/subjects` (and the "Subjects" nav item) lands on the first subject's detail.
- Deleting the current subject redirects to `/subjects`, which lands on the next remaining subject.
- Deleting the last remaining subject lands on the "No subjects yet" empty state.
- From the empty state, "Create your first subject" → create → lands on the new subject's detail.

**Implementation Note**: After Phase 2 automated checks pass, pause for manual confirmation.

---

## Testing Strategy

This is a UI-routing change; the cheapest risk-appropriate layer is manual click-through plus the build
gate. Defer the formal test decision to the slice-review-gate, consistent with
`context/foundation/test-plan.md` (risk-first, cheapest layer per risk).

### Unit Tests:

- None compelling — the only branch logic is `/subjects`'s "first subject vs empty" redirect, which is a
  server-component redirect better covered by E2E than a unit test.

### Integration / E2E (review-gate's call):

- Optional Playwright: open a subject → switch via the dropdown → assert URL/heading; delete-to-empty →
  assert the empty state. Only if the review gate judges the routing risk worth a browser test.

### Manual Testing Steps:

1. Switch subjects via the dropdown; confirm navigation and that the current subject is preselected.
2. New subject → create → land on it. Edit subject → save. Delete subject → land on next / empty.
3. Add note to this subject → new-note form prefilled with the subject.
4. Resize to mobile: switcher, New subject, add-note, and the notes sheet are all reachable.

## Migration Notes

No data or schema changes. Pure routing/UI. The "Subjects" nav item now resolves to a subject detail via
the `/subjects` redirect; confirm nav active-state still highlights under `/subjects/*`.

## References

- Change identity + approved design: `context/changes/subjects-switcher-detail-view/change.md`
- PageShell slots: `src/components/layout/page-shell.tsx:90-99`
- Combobox API: `src/components/ui/combobox.tsx`
- Reused query: `src/features/subjects/queries.ts:22` (`getSubjects`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Subject switcher + detail header rewire

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck`
- [x] 1.2 Linting passes: `pnpm lint`
- [x] 1.3 Production build compiles: `pnpm build`

#### Manual

- [ ] 1.4 Switcher shows current subject; selecting another navigates
- [ ] 1.5 "New subject" → create → lands on new subject
- [ ] 1.6 "Edit subject" / "Delete subject" both work
- [ ] 1.7 "Add note to this subject" atop notes list, opens subject-scoped new-note form
- [ ] 1.8 Notes list scrolls independently; page does not scroll; mobile reachable

### Phase 2: Collapse the listing page + remove dead code

#### Automated

- [x] 2.1 No dangling references: `grep -rn "SubjectsList\|getSubjectsList\|SubjectListItemT" src` empty
- [x] 2.2 Type checking passes: `pnpm typecheck`
- [x] 2.3 Linting passes: `pnpm lint`
- [x] 2.4 Production build compiles: `pnpm build`

#### Manual

- [ ] 2.5 `/subjects` and the nav item land on the first subject's detail
- [ ] 2.6 Delete current subject → lands on next remaining subject
- [ ] 2.7 Delete last subject → "No subjects yet" empty state
- [ ] 2.8 Empty state → "Create your first subject" → create → lands on new subject
