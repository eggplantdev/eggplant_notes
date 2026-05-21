# Reference repositories

Other projects of the user that this project may legitimately draw patterns, conventions, and tooling decisions from. **Authority level: inspiration, not canon** — these references are weighed against this project's own PRD and tech-stack hand-off, never blindly mirrored.

## `wykonczymy` — primary reference

- **Path on disk**: `/Users/konradantonik/workspace/yolo/wykonczymy`
- **What it is**: A production Next.js 16 + React 19 app for a renovation/finishing company. Built and maintained by the user; reflects the user's current conventions and taste.
- **Permission scope**: granted in `.claude/settings.local.json` via `permissions.additionalDirectories` so Read/Grep/Glob can reach it. Bash inspection commands (`ls`, `grep`, `find`, etc.) are broadly allowed at the project level.

### Stack snapshot (as of read date 2026-05-21)

| Layer           | Reference uses                                                                               | This project uses                                                                  |
| --------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Framework       | Next.js 16 + React 19 (App Router)                                                           | Next.js 16 + React 19 (App Router)                                                 |
| Language        | TypeScript                                                                                   | TypeScript                                                                         |
| Styling         | Tailwind 4 + shadcn (`new-york` style, `neutral` base)                                       | Tailwind 4 + shadcn (`nova` preset, neutral base — confirm via `components.json`)  |
| UI primitives   | Radix UI (unified `radix-ui` package + per-component @radix-ui packages)                     | Radix via shadcn defaults                                                          |
| Forms           | TanStack Form + Zod 4                                                                        | Same (per global `react.md` rules)                                                 |
| State           | Zustand (selector pattern)                                                                   | Same (per global rules)                                                            |
| Backend / data  | **Payload CMS 3.73 + Vercel Postgres + Vercel Blob**                                         | **Supabase + Postgres + Auth + RLS via `@supabase/ssr`** ← divergence, intentional |
| Auth            | Payload-managed                                                                              | Supabase Auth                                                                      |
| Package manager | pnpm 10                                                                                      | pnpm 10                                                                            |
| Node            | 24 (pinned via `mise.toml`)                                                                  | 24 (pinned via `mise.toml`)                                                        |
| Pre-commit      | husky + lint-staged                                                                          | husky + lint-staged (set up)                                                       |
| Format          | Prettier 3 + `prettier-plugin-tailwindcss`                                                   | Prettier 3 + `prettier-plugin-tailwindcss` (set up)                                |
| Lint            | ESLint 9 flat config + `eslint-config-next` + `typescript-eslint` + `eslint-config-prettier` | ESLint 9 flat config from `create-next-app` baseline                               |
| Tests           | Vitest 4                                                                                     | Vitest (set up)                                                                    |
| Deployment      | Vercel                                                                                       | Vercel                                                                             |

### `src/` layout in the reference

```
src/
  __tests__/        # vitest specs
  access/           # Payload access control (Payload-only — DO NOT mirror)
  app/              # Next.js App Router
  collections/      # Payload collections (Payload-only — DO NOT mirror)
  components/
    ui/             # shadcn primitives
    <feature>/      # feature-scoped components
  fonts/            # font files / config
  hooks/            # custom React hooks
  lib/              # utilities, helpers, server-only modules
  migrations/       # DB migrations (Payload-specific — DO NOT mirror)
  payload-types.ts  # Payload-only
  payload.config.ts # Payload-only
  proxy.ts          # routing middleware
  seed.ts           # Payload seed (Payload-only)
  stores/           # Zustand stores
  styles/           # extra CSS modules / globals
  types/            # shared TS types
```

### What to draw from `wykonczymy` (inspiration)

- **Tooling stack**: mise, husky, lint-staged, prettier config, vitest config, ESLint flat config layout. Copy/adapt as the project grows.
- **`src/` skeleton**: `stores/`, `lib/`, `hooks/`, `types/`, `components/ui`. Already mirrored in this project.
- **Component patterns**: shadcn composition recipes (form handling with TanStack Form + Zod, Radix dialogs, table patterns with TanStack Table + Virtual).
- **State patterns**: Zustand selector usage, store organization.
- **Server-only patterns**: anything imported from `server-only` package; data-loader conventions; Vercel-deployable function shapes.
- **Routing middleware (`proxy.ts`)**: pattern for request interception, auth gating, redirects.
- **Naming conventions**: file/dir naming follows the user's global `code_style.md` rules — kebab-case files, PascalCase components.

### What NOT to draw from `wykonczymy`

- **Payload CMS layer in its entirety**: `access/`, `collections/`, `migrations/`, `payload.config.ts`, `payload-types.ts`, `seed.ts`, anything `@payloadcms/*`. This project uses Supabase instead, per `context/foundation/tech-stack.md`. Backend boundaries, auth flow, and data modeling all live in a different shape.
- **Payload-specific scripts**: `payload generate:importmap`, `payload generate:types`, `payload migrate` in the `build` script. Do not port the prebuild chain.
- **Domain logic**: anything specific to construction/renovation (cost estimates, transfers, advances). Not relevant to a coding-learning companion.
- **Vercel Blob / Vercel Postgres usage**: replaced by Supabase Storage / Supabase Postgres.

### Decision rule when in doubt

If a pattern in `wykonczymy` is **not** Payload-specific and **not** domain-specific, it's a candidate to inherit. When the question is "how does the user usually do X in Next.js?", consult the reference first, then this project's own PRD/tech-stack to confirm fit, then apply.

When `wykonczymy`'s approach conflicts with this project's tech-stack (e.g., auth flow), this project's tech-stack wins — the reference is one input, not the spec.
