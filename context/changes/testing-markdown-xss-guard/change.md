---
change_id: testing-markdown-xss-guard
title: Markdown render XSS guard — prove note bodies render inert (test-plan Phase 7)
status: implementing
created: 2026-06-09
updated: 2026-06-09
archived_at: null
---

## Notes

Open a change folder for rollout Phase 7 of context/foundation/test-plan.md: "Markdown render XSS guard".
Risks covered: #7 (complements #3). Test types planned: e2e (paste & observe).

Risk response intent (R#7): prove a note body carrying <script>, an on\*= handler, and a javascript:/data:text/html link renders INERT — no script runs, no element/handler injected into the DOM, dangerous href neutralized. Challenge "we don't use rehype-raw, so we're safe". Avoid: asserting only "no alert appeared", or testing react-markdown internals vs our pipeline's output.

Pre-known context to record (from M3 audit + lessons, verify via /10x-research):

- A user-path XSS guard ALREADY EXISTS (e2e/notes.spec.ts). Phase 7 = register it in §2 + EXTEND to the AI body source.
- Backport (fold into research): §2 missing two rows — (D.1) user-markdown XSS is live today; (D.2) ordering integrity.
- Ground the pipeline: markdown-plugins.ts / urlTransform / custom a-img components.
- Reuse: data-testid locators; fresh prod server (3100); assert persisted effect not HTTP 200 (M3 L5); retries:2.
