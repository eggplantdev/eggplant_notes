# Folder structure — three options, scored for growth

> Decision reference for project layout. Assumption baked in: **this project might grow**
> (more features, more files, possibly more contributors). Optimize for the late phase, not
> the first 20 files.

## TL;DR

- The only durable rule is **colocation**: _things that change together live together_
  (Robert C. Martin's real definition of SRP — "gather together the things that change for
  the same reason").
- Pick **one primary axis** and be ruthless. Mixed-without-a-rule is what actually hurts.
- For a growing app, **Option C (hybrid: feature-first + rule-governed shared tier)** wins.

---

## Option A — By-type / layered

Organize by technical role. The tutorial default.

```
src/
├── app/                      # routes
├── components/               # ALL components
│   ├── forms/
│   └── ui/
├── hooks/                    # ALL hooks
├── lib/
│   ├── auth/
│   ├── supabase/
│   └── actions/
├── types/                    # ALL shared types
└── stores/                   # ALL zustand stores
```

```
              ┌─────────────────────────────────────────┐
   a feature  │   components/   hooks/   lib/   types/    │
   change ───►│       │           │        │       │      │   ← touches 4+ sibling
   fans out   │     NoteCard   useNote  note-api  noteT   │     folders for ONE change
              └─────────────────────────────────────────┘
                 code that changes together lives APART
```

**Pros**

- Zero decisions early — you always know the folder. Fastest for the first ~30 files.
- Matches every boilerplate + your muscle memory. Frictionless onboarding.
- Easy to find "all the X".

**Cons**

- Scales badly on the axis that matters: one feature change fans out across many folders.
- `lib/` / `utils/` / `helpers/` rot into 40-file junk drawers.
- Deleting a feature means hunting fragments across the whole tree → orphans left behind.

**Verdict:** Only viable if the app stays small _or_ the convention is rigidly enforced
(Rails-style). Neither holds for a solo MVP that might grow. **Reject.**

---

## Option B — By-feature (domain-first)

Organize by business domain. Each feature owns its components, actions, types.

```
src/
├── app/                      # thin routing only
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── actions/
│   │   ├── use-session.ts
│   │   ├── schema.ts
│   │   └── types.ts
│   ├── notes/
│   │   ├── components/
│   │   ├── actions/
│   │   └── types.ts
│   └── topic-checks/
│       └── ...
├── lib/                      # only genuinely global infra
│   └── supabase/
└── components/ui/            # shadcn primitives only
```

```
   a feature      ┌──────────────────────┐
   change ───────►│  features/notes/      │   ← ONE folder. components +
   stays local    │   ├── components/     │     actions + types together.
                  │   ├── actions/        │
                  │   └── types.ts        │   rm -rf features/notes
                  └──────────────────────┘   ≈ feature gone, no orphans
       code that changes together lives TOGETHER
```

**Pros**

- Colocation by default — a feature PR touches one folder.
- Deletion is trivial (`rm -rf features/x`) — the best signal that boundaries are right.
- Scales linearly: 3 features or 30, each is self-contained.
- Surfaces real coupling smells (e.g. `notes` reaching into `auth` internals).

**Cons**

- The "where does shared code go?" tax — every cross-feature helper is a fresh decision.
- Without discipline → either premature `lib/` dumping or cross-feature imports
  (`features/notes` importing `features/auth/internal`), which is _worse_ than by-type.
- Tempts devs to make a folder per component (`features/button/`) — features are
  **domains**, not components.

**Verdict:** Right primary axis for a growing app. Its one weakness (shared code) is solved
by Option C — which is "B done properly."

---

## Option C — Hybrid: feature-first + explicit shared tier ✅ recommended

Option B plus a _named, rule-governed_ home for shared code, so placement becomes
mechanical instead of a per-file argument.

```
src/
├── app/                      # routing; route groups mirror features: (auth), (protected)
├── features/                 # domain code — the bulk
│   ├── auth/
│   │   ├── components/
│   │   ├── actions/
│   │   ├── use-session.ts
│   │   ├── schema.ts
│   │   └── types.ts
│   ├── notes/
│   └── topic-checks/
├── shared/                   # promoted-on-2nd-use; by-type INSIDE
│   ├── components/           # cross-feature components
│   ├── hooks/
│   └── types/
├── components/ui/            # shadcn primitives (dumb, design-system level)
└── lib/                      # infra clients only: supabase, env, fetch wrapper
```

### The promotion rule (this is what kills the fighting)

Three tiers. Promotion is **one-directional** and **objective**:

```
         start here                promote on          infra / primitives
              │                  2nd real consumer            only
              ▼                         ▼                       ▼
   ┌──────────────────┐      ┌──────────────────┐    ┌──────────────────┐
   │   features/<x>/   │ ───► │     shared/       │    │  lib/            │
   │                   │      │  (by-type inside) │    │  components/ui/  │
   │  EVERYTHING       │      │                   │    │                  │
   │  starts inside    │      │  used by 2+       │    │  NO business     │
   │  its domain       │      │  features         │    │  logic, ever     │
   └──────────────────┘      └──────────────────┘    └──────────────────┘
        1                            2                        3

   Rule: write it in features/ first. Move to shared/ only on the SECOND
   consumer — never the first (Rule of Three for file placement).
```

**Pros**

- Keeps B's colocation + trivial deletion, _and_ gives shared code a legit home.
- Placement is a **check, not taste** ("2+ consumers?") → stops per-project re-deciding.
- Maps cleanly onto Next 16's forced split: `app/` = routing, `features/` = logic,
  `components/ui` = primitives. Three concerns, three folders, no overlap.
- Matches where this repo is already drifting (`lib/auth`, `lib/actions`,
  `components/forms`) — C just names the intent.

**Cons**

- One more tier than pure B — the `shared/` vs `lib/` boundary needs a one-line definition
  (below) or it blurs.
- "Promote on 2nd use" requires actually moving code later. Skip the refactor and `shared/`
  slowly becomes the junk drawer B was avoiding.

**Boundary definition (paste into AGENTS.md):**

- `lib/` = framework/infra clients with no domain knowledge (supabase client, env, fetch).
- `components/ui/` = dumb design-system primitives (shadcn). No data, no business logic.
- `shared/` = domain-aware code used by **2+ features**. Promoted, never born here.
- `features/<x>/` = everything else. The default. Born here.

**Verdict:** Best fit for "solo MVP that might grow." B's correctness with an escape valve
governed by a rule, not vibes.

---

## Side-by-side

| Concern                | A: By-type        | B: By-feature    | C: Hybrid         |
| ---------------------- | ----------------- | ---------------- | ----------------- |
| First ~20 files        | Fastest           | Slight friction  | Slight friction   |
| At 100+ files          | Painful fan-out   | Clean            | Clean             |
| Delete a feature       | Hunt fragments    | Trivial          | Trivial           |
| Where does shared go?  | Everywhere (junk) | Ambiguous (risk) | **Rule-governed** |
| Enforces boundaries    | No                | Yes              | Yes               |
| Decision cost per file | None              | Medium           | Low (mechanical)  |
| Fits Next 16 `app/`    | Awkward           | Good             | **Best**          |

**The trade in one line:** A has zero upfront decision cost but _unbounded_ late cost;
C has small upfront cost but _bounded, mechanical_ late cost. For "might grow," you're
betting on the late phase — pay a little now to cap the pain later.

---

## How other ecosystems solve the same problem

- **Angular** — enforces by-feature via `NgModule`. Framework refuses sprawl. No debates,
  but rigid.
- **Rails** — aggressively by-type (`models/`, `controllers/`, `views/`). Survives on
  _convention over configuration_: everyone knows where everything is. Lesson: by-type works
  _if_ the convention is universal and enforced — not true in a solo JS project.
- **Nx / package-by-feature (Java)** — Option C taken to physical package boundaries.
