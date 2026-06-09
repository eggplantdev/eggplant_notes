---
name: clc-note-api
description: >-
  Interact with the Coding Learning Companion (CLC) app's HTTP API — read your subjects/notes and add
  notes and spaced-repetition memory cards over HTTP, authenticated by a personal `clc_` API token you
  mint in the app's Settings. Use this skill whenever you need to push a note or memory card INTO the CLC
  learning app, use a `clc_...` token, or call `/api/notes`, `/api/memory-cards`, or `/api/subjects`.
  Trigger even when the user only says "add this to my learning app", "save these as memory cards in CLC",
  "create a note in my coding companion", or hands you a `clc_...` token.
---

# CLC HTTP API — notes & memory cards via personal token

The Coding Learning Companion app exposes a small HTTP API so an agent can read the user's structure and
add **notes** (markdown) and **memory cards** (spaced-repetition recall prompts). Every request is scoped
by the server to the token's user — you never pass a `user_id`, and you can only ever touch that one
user's data.

> **You downloaded this skill from the app, so the base URL is already filled in below.** It points at the
> exact deployment you got it from.

```bash
BASE={{CLC_BASE_URL}}                 # injected at download time — the app's origin
TOKEN=clc_...                          # paste the token you minted in Settings (see below)
AUTH="Authorization: Bearer $TOKEN"
```

## Getting a token

1. Open the CLC app → **Settings → CLI Tokens**.
2. Click **Create token**, give it a name (e.g. `cli`), and copy the `clc_...` value — it is shown **once**
   and stored hashed, so it can never be displayed again. If you lose it, revoke it and mint a new one.
3. Paste it as `TOKEN` above. Revoke any token from the same Settings page at any time.

There is nothing else to install or configure — the token is the only credential.

## Recommended workflow

Notes and cards live under an optional **subject** (a topic). Read structure first so you reuse an existing
subject instead of creating duplicates:

1. `GET /api/subjects` → see existing topics; grab a `subject_id` to reuse, or decide to make a new one.
2. `POST /api/notes` → create the note under an existing subject (`subject_id`) **or** a new one created
   inline (`subject_title`). Include its recall cards in the same call via `checks`.
3. `POST /api/memory-cards` → add more cards to a note later, or create standalone cards.

## Endpoints

### `GET /api/subjects` — list topics

```bash
curl -s -H "$AUTH" "$BASE/api/subjects"
# → { "subjects": [ { "id": "<uuid>", "title": "Rust" }, ... ] }
```

### `GET /api/notes` — list note titles

Optional `?subject=<uuid>` filter. A malformed `subject` value returns `400`.

```bash
curl -s -H "$AUTH" "$BASE/api/notes"
curl -s -H "$AUTH" "$BASE/api/notes?subject=<subject-uuid>"
# → { "notes": [ { "id": "<uuid>", "title": "...", "subject_id": "<uuid>|null" }, ... ] }
```

### `POST /api/notes` — create a note (+ optional cards)

```jsonc
{
  "note": {
    "title": "Ownership basics", // required, trimmed, ≤ 200 chars
    "content": "# Ownership\n...", // markdown; may be "" (a title-only note is valid)
    "subject_id": "<uuid>", // attach to an EXISTING subject — OR omit and use subject_title
    // "subject_title": "Rust"        // create a NEW subject inline. Mutually exclusive with subject_id.
  },
  "checks": [
    // recall cards for this note; ≤ 50; may be [] for none
    { "prompt": "What is ownership?", "example": "", "code_context": "" },
  ],
}
```

```bash
curl -s -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"note":{"title":"Ownership basics","content":"# Ownership","subject_title":"Rust"},"checks":[{"prompt":"What is ownership?","example":"","code_context":""}]}' \
  "$BASE/api/notes"
# → 201 { "id": "<note-uuid>" }
```

### `POST /api/memory-cards` — add cards

Two body shapes. The server picks the branch by whether `note_id` is present, then validates strictly — so
don't mix them.

**Attach cards to an existing note** (include `note_id`, 1–20 cards):

```bash
curl -s -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"note_id":"<note-uuid>","cards":[{"prompt":"Borrow vs move?","example":"","code_context":""}]}' \
  "$BASE/api/memory-cards"
# → 201 { "ids": ["<card-uuid>"] }
```

**Standalone card** (no `note_id`; `subject_id` is a uuid or `null` for unfiled):

```bash
curl -s -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"prompt":"What is a lifetime?","example":"","code_context":"","subject_id":null}' \
  "$BASE/api/memory-cards"
# → 201 { "ids": ["<card-uuid>"] }
```

## The card field shape — get this right or you get a 400

Every card (in `checks` or `cards`) has exactly these fields:

| field          | rule                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| `prompt`       | **required** string, trimmed, ≤ 2000 chars. The question/recall cue.                     |
| `example`      | **required to be a string** — use `""` when there's none. The server turns blank → null. |
| `code_context` | same as `example`: a string, `""` when none.                                             |

**Do not send `null` for `example`/`code_context`** — they are validated as strings, so `null` is a `400`,
not "no value". Send `""`. Omitting `prompt`, or sending `cards` as anything but a non-empty array, is also
a `400`.

## Responses & limits

- **Success:** `200` for GETs; `201` for creates, returning `{ "id": ... }` (note) or `{ "ids": [...] }` (cards).
- **`401`** — token missing, malformed, expired, or revoked. Re-check the `Authorization` header; mint a
  fresh token in Settings if it was revoked.
- **`400`** — malformed JSON, or a body that fails validation (card-shape rules, the `subject_id` XOR
  `subject_title` rule, or an invalid uuid).
- **`500`** — unexpected server error.
- **Caps:** ≤ 50 cards per note (`checks`), 1–20 cards per `note_id` attach (`cards`), `prompt` ≤ 2000 chars,
  `title` ≤ 200 chars. Batch larger imports across multiple calls.

## Quick end-to-end smoke test

```bash
curl -s -H "$AUTH" "$BASE/api/subjects"                                              # 1. read structure
NOTE=$(curl -s -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"note":{"title":"Smoke test","content":"# hi","subject_title":"Sandbox"},"checks":[{"prompt":"Does the API work?","example":"","code_context":""}]}' \
  "$BASE/api/notes")                                                                 # 2. create note + card
echo "$NOTE"                                                                          # → {"id":"..."}
ID=$(echo "$NOTE" | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
curl -s -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"note_id\":\"$ID\",\"cards\":[{\"prompt\":\"A second card?\",\"example\":\"\",\"code_context\":\"\"}]}" \
  "$BASE/api/memory-cards"                                                            # 3. attach another card
curl -s -H "$AUTH" "$BASE/api/notes"                                                  # 4. confirm it's listed
```
