# FAQ page — design (scuffle / first pass)

Date: 2026-06-09 · Change id: `faq-page`

## Goal

A protected, in-app `/faq` page that explains the app's data, AI, and CLI-API
features to a logged-in user. First pass — static content only, no DB, no search.

## Decisions (locked with user)

- **Audience:** protected, in-app (behind auth, in the nav). Not public.
- **Polish:** static content page. One route + a typed content array + a small
  client disclosure component. No DB, no MDX, no client-side search.
- **PDF/vision note input:** mark as **"coming soon"** (it is Phase 2, not shipped).
- **Agent skill bullet:** do **not** build a new agent skill in this change. The
  FAQ only _documents_ how to point an agent at the CLI token API.
- **Scope:** the user's three topic groups only — no FSRS explainer, no
  contact/sample-data Q&As ("scope fine for now").

## Placement

Confirmed against the repo's existing conventions (`feature-first-structure`,
`react.md`, `styling.md`); revalidate at plan time:

- Route: `src/app/(protected)/faq/page.tsx` — Server Component, renders the page
  shell + sections. Reuses `components/layout/PageShell` (container width via the
  `container-shell` `@utility`).
- Content data: `src/app/(protected)/faq/faq-data.ts` — a typed `as const` array
  (lowest tier; colocated with the only route that uses it; promote to a feature
  only if a second consumer appears).
- Disclosure UI: a small **client** component (interactivity = local open state),
  e.g. `src/components/faq/faq-accordion.tsx`. One concern per file (`react.md`:
  one component per file, named export, `function` keyword).
- Nav: add `{ href: '/faq', label: 'FAQ' }` to `NAV_ITEMS` in
  `src/components/app-nav/nav-items.ts`.

## Accordion approach

No shadcn `accordion` is installed and none is added. Mirror the **existing**
repo idiom: a `group` `<button>` trigger carrying `aria-expanded`, local
`useState` open state, and the existing `AccordionArrow`
(`@/components/ui/accordion-arrow`) as the disclosure indicator — exactly as
`src/features/import/components/source-input.tsx:64` does it. The arrow needs a
`group` ancestor (its hover glow is `group-hover`-driven).

## Data shape

```ts
// faq-data.ts
type FaqItemT = { question: string; answer: string } // answer: short markdown-free prose
type FaqSectionT = { id: string; title: string; items: FaqItemT[] }
export const FAQ_SECTIONS: readonly FaqSectionT[] = [
  /* ... */
] as const
```

Answers are plain strings. The one structured payload — the CLI endpoint table —
is rendered as a real `<table>` in the component, keyed off a section id (not
crammed into a prose string).

## Content (three sections)

### 1. Your data

- **Can I export or send my data out?** — No export/download today. The footer
  "Contact me" button sends a message to the operator; it does not export data.
- **How do I delete my data?** — Settings → Danger zone → **Delete Account**.
  Permanent and irreversible; cascades to delete all your subjects, notes, and
  memory cards.

### 2. AI features

Framing: BYOK — you connect your **own** OpenRouter key in Settings; generation
runs server-side, the key is encrypted at rest, and every AI result is
**preview-gated** (you review/edit before anything saves).

- **How are notes generated with AI?** — From a topic string (create-note form),
  or by importing text/markdown and letting AI decompose it into multiple notes.
  **PDF/vision import — coming soon.**
- **How are cards generated with AI?** — Three ways: from an existing saved note,
  from a topic string, or inline while drafting a note. Same preview-before-save.
- **How do I use AI to author notes?** — Use the topic generator on the
  create-note form, or the Import page's AI decompose. Both let you edit the
  result before saving.

### 3. CLI / agent API

- **What endpoints are exposed?** — table:

  | Method | Endpoint            | Purpose                                                 |
  | ------ | ------------------- | ------------------------------------------------------- |
  | GET    | `/api/subjects`     | List your subjects (id, title)                          |
  | GET    | `/api/notes`        | List your notes (id, title); optional `?subject=<uuid>` |
  | POST   | `/api/notes`        | Create a note (+ optional cards); returns note id       |
  | POST   | `/api/memory-cards` | Create card(s) on a note or standalone; returns ids     |

- **How do I authenticate?** — Send `Authorization: Bearer <token>`. Tokens are
  `clc_`-prefixed; only the SHA-256 hash is stored server-side, and every call is
  RLS-scoped to your account.
- **How do I point an agent at the API?** — Give the agent your token and the base
  URL; have it `GET /api/subjects` to pick/confirm a subject, then `POST /api/notes`
  / `POST /api/memory-cards` to author content. (No separate agent skill ships in
  this change.)

## Out of scope / non-goals

- No public/unauthenticated route.
- No search, filtering, or anchor/TOC nav.
- No DB-backed or MDX-authored FAQ; content is a static array.
- No FSRS/spaced-repetition explainer; no contact or sample-data Q&As.
- No new agent skill built — documentation only.

## Testing

Per `context/foundation/test-plan.md` (risk-first): a static content page with one
disclosure toggle is low risk. No unit tests for hardcoded copy. If anything is
worth an E2E later, it's a single smoke check that `/faq` renders behind auth and a
section expands — defer unless the gate calls for it.
