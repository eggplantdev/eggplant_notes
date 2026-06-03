# S-07 create-note-with-checks — deferred review findings

Findings surfaced by the review→`/simplify` gate that were deliberately deferred (real, but
out of this slice's scope or not worth the tradeoff now). Recorded per the project convention
(cf. S-01/S-02 `follow-ups/review-fixes.md`).

## 1. Shared topic-check field group (dedup vs `topic-check-form.tsx`)

- **Source:** `/simplify` reuse + altitude agents.
- **What:** The staged-check rows in `src/features/notes/note-form.tsx` (example `Textarea`
  block + `code_context` `MarkdownEditor`+`MarkdownPreview` block) are near-verbatim copies of
  the same blocks in `src/features/topic-checks/topic-check-form.tsx`. There are now two
  independent topic-check editor UIs that can drift (e.g. adding a field to `topic_checks` means
  wiring it in both).
- **Why deferred:** A real dedup must edit `topic-check-form.tsx` to consume the shared
  component — otherwise note-form would be the only consumer (1st-consumer, premature promotion).
  That edit is **outside this slice's diff** and lands in the `topic-checks` feature, which the
  parallel S-08 work also touches. The `prompt` field can't be shared cleanly anyway
  (`field.Input` is bound to each `useAppForm` instance). Better as its own small refactor change
  once S-08 has merged.
- **Suggested fix:** Extract presentational `OptionalTextareaField` + `CodeContextField`
  (plain `value`/`onChange`/`onBlur` props, zero form coupling) into `src/components/forms/`,
  consumed by both the note-form staged rows and `topic-check-form.tsx`. 2nd-consumer promotion
  is licensed at that point.

## 2. Stable keys for staged-check rows

- **Source:** `/simplify` efficiency agent.
- **What:** Rows render with `key={i}` (array index). On `removeValue(i)` of a middle row, every
  later row shifts index → React remounts the lazy `MarkdownEditor` for rows below the removed
  one (losing transient editor focus/scroll; field _values_ persist via form state).
- **Why deferred:** Low-volume authoring path; mid-list removal is rare and only loses transient
  editor focus, not data. A stable-id fix means adding a client-only `id` to each row, which
  diverges the array-item type from the clean schema-derived `StagedCheckInputT` and needs
  stripping before submit — not worth muddying the type for a rare interaction.
- **Suggested fix:** If it ever bites, track a parallel stable-id list (or wrap rows) keyed
  independently of the form array, leaving `StagedCheckInputT` clean.
