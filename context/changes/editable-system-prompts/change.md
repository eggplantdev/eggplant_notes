---
change_id: editable-system-prompts
title: User-editable, persisted AI system prompts
status: implementing
created: 2026-06-08
updated: 2026-06-08
---

## Notes

BYOK OpenRouter users want to tune the AI's behavior, not just accept the built-in prompts. Concrete
pain: `CARDS_SYSTEM` hardcodes "3 to 7 cards" (`prompts.ts:39`), which is wrong for some material.

Today the generate dialog already renders an EDITABLE System-prompt textarea + a Reset button
(`generate-dialog.tsx:205,193`), but the edit is ephemeral — `openConfig` wipes the override on every
open (`generate-dialog.tsx:110`). This slice makes the **System prompt** edit PERSIST per user.

Scope: persist the system prompt for all three keys — `cards`, `notes_decompose` (text + PDF share it),
`notes_topic`. Two buttons in the dialog: **Save prompt** (upsert; delete-if-equals-built-in) and
**Reset prompt** (destructive, AlertDialog-confirmed → delete saved row → back to the built-in constant).

Out of scope: persisting the **Prompt** (user-message) half — it interpolates per-generation material
(`${material}`) and stays an ephemeral one-shot override exactly as today. No template tokens. No
settings-page surface (editing lives in the dialog where the prompt is already shown). Prompt-cache
fragmentation is a non-issue (BYOK).

Full design: `design.md`.
