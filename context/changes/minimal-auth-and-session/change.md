---
change_id: minimal-auth-and-session
title: Minimal auth and session
status: implementing
created: 2026-06-02
updated: 2026-06-02
archived_at: null
---

## Notes

- **Scope decision (2026-06-02):** Plan must include a first phase that starts the local Supabase stack (`supabase start`) and populates `.env.local` with the local keys — the stack is configured (`supabase/config.toml`) but not running, and `.env.local` does not exist yet. Without it, nothing auth-related runs locally.
- **SSR helper caveat:** `@supabase/ssr@^0.10.3` is pre-1.0; verify the `getAll`/`setAll` cookie contract against live docs (Context7) for Next.js 16's async `cookies()` — do not rely on training data.
- **Config already aligned:** `config.toml` has `enable_signup = true`, `enable_confirmations = false` — matches roadmap F-01's "no email-verification gate" (FR-002).
- **Out of scope:** app-table migrations (`notes`/`topic_checks`/`review_events`) belong to F-02 `persistence-and-isolation`; F-01 builds against Supabase's built-in `auth.users` only.
