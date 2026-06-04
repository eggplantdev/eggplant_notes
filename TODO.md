# Coding Learning Companion — Backlog (operator triage)

> Markdown notes grouped into subjects + spaced-repetition recall cards. Eggplant-branded.
> **Deadline 2026-06-10 · today 2026-06-04 (~6 days slack).**
>
> **Status: the product WORKS.** North Star (recall loop) + every v1-usable slice + both fast-follow slices are shipped. All roadmap slices **S-01..S-10 done**. Only unstarted roadmap item is **S-11** (perf, status `proposed`).
> This backlog is **post-deadline-subset polish + new features — NOT critical-path work.**

---

## Cluster 1 — Branding / identity ("eggplant_notes")

_App currently has no name/logo/footer._

- [ ] Rename app to `eggplant_notes` — replace placeholder app title across UI/metadata.
- [ ] Eggplant logo — brand mark for nav/landing/favicon.
- [ ] Eggplant landing/about page ("bakłażan page") + a nav link to it.
- [ ] Branded loader (bouncing eggplant) — replace remaining loaders/spinners.
- [ ] Footer (copyright etc.).
- [ ] **Open design question (not a task):** show note content/snippet in the notes list view, or keep titles-only?

## Cluster 2 — UI polish

- [ ] Separate the drag handle from the card body in subject reorder — dnd affordance ≠ whole card.
- [ ] Edit a note directly from the `subjects/[id]` view.

Subjects/id view
New not -> add note
Edit -> Edit subject
Delete - Delete subject

Separately - we need to also open note edit from this view

- Subject edit is opening a new edit page - no need for this just edit in place
- Navigation within sections o nthe side - vercel/nextjs style see fest reference docs repo
- navigation is a dnd this way we can reorganize notes
- assessing whever adding virtual scroll makes sense on any view
- subjects view

## Cluster 3 — Dashboard features

- [ ] Dail Goal
- [ ] Today's progress bar.

## Cluster 4 — Performance (= roadmap S-11, already scoped)

- [ ] Caching between route navigations / revalidate strategy. **Real blocker:** Next 16 `'use cache'` can't read cookies, but RLS scopes rows by the auth cookie — must resolve per-user cache keying first. A `staleTimes` stopgap was tried and reverted (no targeted invalidation).
- [ ] Stop over-fetching: select only needed columns (notes list pulls full objects/`content` but renders titles).
- [ ] Pagination for the notes list.
- [ ] Virtualised long lists (TanStack Virtual).

## Cluster 5 — Real-data dogfooding benchmark (acceptance test) · **IN PROGRESS / next up**

- [ ] Seed the app with REAL notes from `/workspace/learning` and verify the whole flow on real content (subject → ordered note-sections → cards in `/review` → card→note jump).
- [ ] **First section chosen: Python — functional programming.**
      Source: `/workspace/learning/python/functional_p/functional_programming_py_notes.md` + `/workspace/learning/flashcards/python_functional/functional_programming_flashcards.md`.
- [ ] **Decision made:** REPLACE the synthetic `test@gmail.com` playground (24 fake subjects / 60 fake notes in `supabase/seed.sql`) with this real content.
- **Modeling friction surfaced:** `topic_checks` has NO answer field (only `prompt`, `example`, `code_context`) — the recall model assumes the answer lives in the source note. The flashcards carry explicit `A:` answers, so seeding must decide where the answer goes. **Current plan: put the answer in the `example` field.**

## Cluster 6 — Later (explicitly deferred)

- [ ] User account page ("konto usera — na później").
- [ ] **Connect an external LLM via OpenRouter (BYOK, PKCE)** — do this **LAST**. Largest new surface: external dependency, credential storage, new auth flow.

---

## Suggested sequencing

1. **Seed / dogfood now** (Cluster 5, already in progress)
2. **Branding** (Cluster 1)
3. **UI polish** (Cluster 2)
4. **Dashboard features** (Cluster 3)
5. **Performance** (Cluster 4 / S-11)
6. **LLM connect** (Cluster 6) — last

**Rationale:** polish + real data is what makes the operator actually keep using the app and is low-risk, so it goes first. S-11 has a genuine architectural blocker (per-user cache keying vs RLS cookie) so it gets its own focused change later. The LLM connect is the biggest/newest surface — last.

---

## Already done — dropped from backlog

These were in the raw braindump but are already shipped:

- Subject-as-document reading (S-06)
- Review skeleton loader removed
- "0 due" header hidden when caught up
- "New note" link on dashboard exists
- Add-note already tied to a subject
