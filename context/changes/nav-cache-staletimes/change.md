---
id: nav-cache-staletimes
title: Navigation cache via staleTimes + mutation busting
status: implementing
created: 2026-06-11
updated: 2026-06-11
roadmap: S-11 (caching half)
---

Closes the caching half of S-11. Enable the client Router Cache for dynamic routes
(`staleTimes.dynamic`) so read→read navigation is instant, and bust it on every
mutation so writes never show stale data.

- Design: `design.md`
- Plan: `plan.md` / `plan-brief.md`
