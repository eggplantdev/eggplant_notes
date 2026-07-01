---
name: eggplant-notes
description: >-
  Read, create, update, and delete your notes and spaced-repetition memory cards in the Eggplant Notes
  learning app over its HTTP API, authenticated by a personal `egg_` API token. Full CRUD: list/read
  structure, add notes and cards, edit them or move them between subjects, rename subjects, and delete any
  of them. Use this skill whenever you need a notes skill or a memory-card skill, need to read from or write
  to the Eggplant Notes app, use an `egg_...` token, or call `/api/notes`, `/api/memory-cards`, or
  `/api/subjects`. Trigger even when the user only says "add this to my notes app", "make memory cards / a
  note for this", "save these as memory cards", "update / rename / move my note, card, or subject", "delete
  that card / note / subject", or hands you an `egg_...` token.
---

# Eggplant Notes HTTP API — notes & memory cards via personal token

The Eggplant Notes app exposes a small HTTP API so an agent can read the user's structure and
add **notes** and **memory cards** (spaced-repetition recall prompts), whose text fields are all markdown
with syntax highlighting (see ["fence your code"](#all-text-fields-are-markdown--fence-your-code)). Every request is scoped
by the server to the token's user — you never pass a `user_id`, and you can only ever touch that one
user's data.

> **You downloaded this skill from the app, so the base URL is already filled in below.** It points at the
> exact deployment you got it from.

## Posting conventions (always follow)

These rules govern every note and card you create or edit:

1. **Draft before posting — open a temp markdown file, don't dump in the terminal.**
   Write the full draft to a temporary `.md` file and open it so the user can read it rendered,
   then wait for explicit approval before calling any write endpoint.

   ```bash
   DRAFT="${TMPDIR:-/tmp}/eggplant-draft-$$.md"   # $$ = PID, unique per run; .md suffix preserved
   # write the note title, content, and every card (prompt / example) into $DRAFT
   # Prefer the user's current editor (VS Code / Cursor) so the draft lands in their workspace.
   # `code`/`cursor` open the file as RAW markdown — there is no CLI flag to open the rendered
   # preview directly, so on macOS we then send Cmd+Shift+V to trigger the editor's preview.
   # That keystroke step is best-effort: it needs Accessibility permission for the terminal and
   # the editor window to take focus. If it doesn't fire, the user can hit Cmd+Shift+V manually.
   EDITOR_APP=""
   if command -v code &>/dev/null; then code "$DRAFT"; EDITOR_APP="Code"
   elif command -v cursor &>/dev/null; then cursor "$DRAFT"; EDITOR_APP="Cursor"
   elif [ -n "$EDITOR" ]; then "$EDITOR" "$DRAFT"
   elif command -v open &>/dev/null; then open "$DRAFT"        # macOS fallback
   elif command -v xdg-open &>/dev/null; then xdg-open "$DRAFT" # Linux fallback
   elif command -v start &>/dev/null; then start "$DRAFT"      # Windows (Git Bash / WSL)
   fi
   # Auto-open the rendered preview (macOS + VS Code/Cursor only).
   if [ -n "$EDITOR_APP" ] && command -v osascript &>/dev/null; then
     sleep 1  # give the editor a moment to focus the newly opened file
     osascript -e "tell application \"System Events\" to keystroke \"v\" using {command down, shift down}" 2>/dev/null || true
   fi
   ```

   Structure the file so it's readable at a glance. A card has exactly two fields — `prompt` and the
   single `example` answer, which holds the prose scenario **and** any fenced code in the one block:

   ````markdown
   # <note title>

   <note content verbatim>

   ---

   ## Memory cards

   ### Card 1

   **Prompt:** the recall cue
   **Example:** short prose scenario, then any code fenced in the same field:

   ```lang
   …
   ```
   ````

   After opening, tell the user the file path and ask for approval. Don't post until they confirm.

2. **No title inside the note `content`.** The note already stores its `title` separately and
   the app renders it, so the body must NOT open with a `# Title` heading that repeats it.
   Start `content` with the actual material.

3. **The note must be fully self-contained; the card need not be.** Write the note for a reader
   who is NOT the user, has zero memory of the conversation, and cannot see the code on screen
   or the surrounding context window. Inline everything: the code being discussed, the scenario,
   definitions of any referenced function/pattern/file, and the "why." Never reference "the code
   above," "this file," or "what we discussed."
   Cards are linked to a note the reader can open instantly, so a card may lean on its note for
   context and just be a sharp recall prompt. The strict self-containment bar is on the **note**,
   not the card.

4. **Self-review before showing the draft.** Critique your own note and card first, and revise
   when it makes sense, against these questions:
   - **Card:** is the question genuinely meaningful — does it test something worth memorising,
     not a trivial or throwaway fact?
   - **Note (comprehensible):** would a cold reader fully understand it? Is anything missing that
     should be added?
   - **Note (signal):** is everything in it important enough to keep — no filler or noise that
     adds length without real value? Cut what doesn't earn its place.

## Persist this skill (install it once)

**If you are an agent reading this from a paste or a one-off file, install it before doing anything else** —
otherwise it vanishes when this session ends and the user has to paste it again every time. Pasting only
loads it for the current turn; saving it as a skill file makes it auto-load in every future session,
discovered by its `name` + `description` with no paste.

Save this entire document (frontmatter included, unchanged) as a `SKILL.md`:

```bash
# Claude Code — personal (all projects):
mkdir -p ~/.claude/skills/eggplant-notes && cp eggplant-notes.skill.md ~/.claude/skills/eggplant-notes/SKILL.md
# …or per-project: .claude/skills/eggplant-notes/SKILL.md
```

Other agents/tools: drop this file wherever your tool auto-loads skills or instructions — it is
self-contained. If a skills directory is available, offer to install it there, then continue with the task.

The token is **not** baked into this skill — that would be a leaked credential sitting in a shareable file.
Instead, resolve it on every run from the machine, first source that exists wins (the same pattern the AWS
and `gh` CLIs use). The user sets it up **once per machine**; after that, any agent session is authenticated
with no pasting. Put this at the top of your workflow:

```bash
BASE={{BASE_URL}}                      # injected at download time — the app's origin
# Resolve the token: $EGGPLANT_TOKEN first, then ~/.config/eggplant/token. No prompting.
TOKEN="${EGGPLANT_TOKEN:-$(cat "${XDG_CONFIG_HOME:-$HOME/.config}/eggplant/token" 2>/dev/null)}"
[ -z "$TOKEN" ] && { echo "No Eggplant token — see 'First-time setup' in the skill." >&2; exit 1; }
AUTH="Authorization: Bearer $TOKEN"
```

## First-time setup (once per machine)

1. Open the Eggplant Notes app → **Settings → CLI Tokens**.
2. Click **Create token**, give it a name (e.g. `cli`), and copy the `egg_...` value — it is shown **once**
   and stored hashed, so it can never be displayed again. If you lose it, revoke it and mint a new one.
3. Store it once, in **either** location the resolver above reads (works on macOS, Linux, and WSL —
   `cat` and `$HOME` exist everywhere; this is why the skill doesn't depend on macOS Keychain or any
   OS-specific secret store):

   ```bash
   # Option A — config file (survives shell/profile changes; recommended):
   mkdir -p ~/.config/eggplant && printf %s 'egg_PASTE_YOUR_TOKEN' > ~/.config/eggplant/token
   chmod 600 ~/.config/eggplant/token            # owner-only read

   # Option B — environment variable (add to ~/.zshrc, ~/.bashrc, or your shell profile):
   export EGGPLANT_TOKEN='egg_PASTE_YOUR_TOKEN'
   ```

That's the whole setup — the token is the only credential, and you never paste it into a chat again.

> **Precedence is env-first.** If `$EGGPLANT_TOKEN` is set it wins over the file, mirroring AWS/12-factor
> config. So if calls suddenly return `401`, check that a **stale** `EGGPLANT_TOKEN` (e.g. an old revoked
> token) isn't shadowing a valid one in the file. Unset it (`unset EGGPLANT_TOKEN`) or update it.

## Recommended workflow

Notes and cards live under an optional **subject** (a topic). Read structure first so you reuse an existing
subject instead of creating duplicates:

1. `GET /api/subjects` → see existing topics; grab a `subject_id` to reuse, or decide to make a new one
   (`POST /api/subjects`).
2. `POST /api/notes` → create the note under an existing subject (`subject_id`) **or** a new one created
   inline (`subject_title`). Include its recall cards in the same call via `cards`.
3. `POST /api/memory-cards` → add more cards to a note later, or create standalone cards.
4. `GET /api/notes/:id` · `GET /api/memory-cards` → read a note's content + cards back, or list/inspect
   cards (filter by note/subject/unfiled) before writing.
5. **Edit, reorganize, or remove**: `PATCH` a note/card/subject to change its fields or move it between
   subjects, and `DELETE` to remove one. See [Endpoints](#endpoints) for the full surface and
   [Linked vs standalone cards](#linked-vs-standalone-cards) for what a subject change does to linked cards.

## Endpoints

### `GET /api/subjects` — list topics

```bash
curl -s -H "$AUTH" "$BASE/api/subjects"
# → { "subjects": [ { "id": "<uuid>", "title": "Rust" }, ... ] }
```

### `POST /api/subjects` — create a topic

Create a subject directly (instead of inline via a note's `subject_title`). `title` required (≤ 200 chars);
`description` optional (≤ 2000 chars).

```bash
curl -s -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"title":"Rust","description":"Ownership, lifetimes, traits"}' \
  "$BASE/api/subjects"
# → 201 { "id": "<subject-uuid>" }
```

### `PATCH /api/subjects/:id` — rename / re-describe a topic

Same body as create (`title` required, `description` optional). A non-existent or not-yours id returns `404`.

```bash
curl -s -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"title":"Rust (2024 edition)"}' \
  "$BASE/api/subjects/<subject-uuid>"
# → 200 { "id": "<subject-uuid>" }
```

### `GET /api/notes` — list note titles

Optional `?subject=<uuid>` filter. A malformed `subject` value returns `400`.

```bash
curl -s -H "$AUTH" "$BASE/api/notes"
curl -s -H "$AUTH" "$BASE/api/notes?subject=<subject-uuid>"
# → { "notes": [ { "id": "<uuid>", "title": "...", "subject_id": "<uuid>|null" }, ... ] }
```

### `GET /api/notes/:id` — read one note + its cards

Reads the note's full `content` back, plus every card linked to it. A non-existent or not-yours id returns `404`.

```bash
curl -s -H "$AUTH" "$BASE/api/notes/<note-uuid>"
# → {
#     "note":  { "id": "<uuid>", "title": "...", "content": "# ...", "subject_id": "<uuid>|null" },
#     "cards": [ { "id": "<uuid>", "prompt": "...", "example": "...|null",
#                  "subject_id": "<uuid>|null", "note_id": "<uuid>" }, ... ]
#   }
```

### `PATCH /api/notes/:id` — edit a note / move it between subjects

Send the full note fields (`title` required, `content` required — may be `""`). Set `subject_id` to move the
note to another subject (a uuid), to `null` to unfile it, or **omit it** to leave the subject unchanged.

When you change `subject_id`, **every linked card follows the note** to the new subject by default. To peel
specific cards off, pass an optional `card_actions`:

- `unlink` — card ids that detach (`note_id` → `null`), keeping their old subject as standalone. Every card
  you don't list still follows the note.

There is no per-card "move" list: a linked card always shares its note's subject, so the only choice is which
cards to detach. Omitting `card_actions` moves all linked cards. A non-existent or not-yours id returns `404`.
See ["Linked vs standalone cards"](#linked-vs-standalone-cards) for the rule.

> **Tell the user what happened to the cards.** A subject move silently re-files all the note's linked
> cards, and `unlink` detaches the ones you name — side effects the user can't see in your request. After
> the call, report it: that the note's cards moved with it, and (if you unlinked any) which cards you
> detached and that they kept their old subject.

```bash
# move the note (and all its cards) to another subject
curl -s -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"title":"Ownership basics","content":"# Ownership","subject_id":"<subject-uuid>"}' \
  "$BASE/api/notes/<note-uuid>"
# → 200 { "id": "<note-uuid>" }

# move the note but DETACH one card instead of moving it (the rest still follow)
curl -s -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"title":"Ownership basics","content":"# Ownership","subject_id":"<subject-uuid>","card_actions":{"unlink":["<card-uuid>"]}}' \
  "$BASE/api/notes/<note-uuid>"
```

### `POST /api/notes` — create a note (+ optional cards)

````jsonc
{
  "note": {
    "title": "Ownership basics", // required, trimmed, ≤ 200 chars
    "content": "# Ownership\n...", // markdown; may be "" (a title-only note is valid)
    "subject_id": "<uuid>", // attach to an EXISTING subject — OR omit and use subject_title
    // "subject_title": "Rust"        // create a NEW subject inline. Mutually exclusive with subject_id.
  },
  "cards": [
    // recall cards for this note; ≤ 50; may be [] for none.
    // example is MARKDOWN — fence code blocks or they render flat (see "fence your code" below).
    {
      "prompt": "What does a `move` do to ownership in Rust?",
      "example": "Passing a String into a function transfers ownership; the caller can't use it afterwards.\n\n```rust\nlet s = String::from(\"hi\");\ntakes(s);          // s is moved\n// println!(\"{s}\"); // ❌ borrow of moved value\n```",
    },
  ],
}
````

```bash
curl -s -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"note":{"title":"Ownership basics","content":"# Ownership","subject_title":"Rust"},"cards":[{"prompt":"What is ownership?","example":""}]}' \
  "$BASE/api/notes"
# → 201 { "id": "<note-uuid>" }
```

### `POST /api/memory-cards` — add cards

Two body shapes. The server picks the branch by whether `note_id` is present, then validates strictly — so
don't mix them.

**Attach cards to an existing note** (include `note_id`, 1–20 cards):

```bash
curl -s -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"note_id":"<note-uuid>","cards":[{"prompt":"Borrow vs move?","example":""}]}' \
  "$BASE/api/memory-cards"
# → 201 { "ids": ["<card-uuid>"] }
```

**Standalone card** (no `note_id`; `subject_id` is a uuid or `null` for unfiled):

```bash
curl -s -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"prompt":"What is a lifetime?","example":"","subject_id":null}' \
  "$BASE/api/memory-cards"
# → 201 { "ids": ["<card-uuid>"] }
```

### `GET /api/memory-cards` — list cards (filtered)

List your cards so you can inspect or dedup before writing. Three optional, combinable filters — a
malformed uuid returns `400`:

- `?note=<uuid>` — only cards linked to that note
- `?subject=<uuid>` — only cards filed under that subject
- `?unfiled=true` — only cards with no subject

```bash
curl -s -H "$AUTH" "$BASE/api/memory-cards?subject=<subject-uuid>"
curl -s -H "$AUTH" "$BASE/api/memory-cards?note=<note-uuid>"
curl -s -H "$AUTH" "$BASE/api/memory-cards?unfiled=true"
# → { "cards": [ { "id": "<uuid>", "prompt": "...", "example": "...|null",
#                 "note_id": "<uuid>|null", "subject_id": "<uuid>|null" }, ... ] }
```

### `PATCH /api/memory-cards/:id` — edit a card / change its subject

Send the full card field set (`prompt`, `example` — same string rules as on create) plus
`subject_id` (a uuid or `null`). Editing only the text fields leaves any note link intact. **Changing the
subject of a card that is attached to a note UNLINKS it** (`note_id` → `null`) — see
["Linked vs standalone cards"](#linked-vs-standalone-cards). If that unlink happens, **tell the user** the
card was detached from its note. A non-existent or not-yours id returns `404`.

```bash
curl -s -X PATCH -H "$AUTH" -H 'content-type: application/json' \
  -d '{"prompt":"Borrow vs move?","example":"","subject_id":"<subject-uuid>"}' \
  "$BASE/api/memory-cards/<card-uuid>"
# → 200 { "id": "<card-uuid>" }
```

## Linked vs standalone cards

A card is either **linked** to a note (`note_id` set) or **standalone** (`note_id: null`). One rule the app
enforces everywhere — including this API — governs the difference:

- A **linked** card always shares its note's subject. You don't set its subject independently; it follows
  the note.
- Moving a note (`PATCH /api/notes/:id` with a new `subject_id`) moves its linked cards too, by default. Use
  `card_actions.unlink` to peel specific cards off instead — they become standalone, keeping their subject.
- Changing the subject of a **linked** card (`PATCH /api/memory-cards/:id` with a different `subject_id`)
  **unlinks it**: a card can't both stay attached and carry a different subject than its note, so it detaches
  and becomes standalone under the new subject. Editing only its text fields keeps the link.
- A **standalone** card owns its subject freely (a uuid, or `null` for unfiled).

### Deleting — `DELETE /api/notes/:id` · `DELETE /api/memory-cards/:id` · `DELETE /api/subjects/:id`

Each deletes one row you own and returns its id; a non-existent or not-yours id returns `404`. Two cascades
are handled by the database — **mind them before you delete**:

- **Deleting a note also deletes all of its cards** (cascade). The cards are gone, not unlinked.
- **Deleting a subject does NOT delete its notes or cards** — they survive and become _unfiled_ (their
  `subject_id` becomes `null`).

```bash
curl -s -X DELETE -H "$AUTH" "$BASE/api/notes/<note-uuid>"          # → 200 { "id": "<note-uuid>" }   (+ its cards gone)
curl -s -X DELETE -H "$AUTH" "$BASE/api/memory-cards/<card-uuid>"   # → 200 { "id": "<card-uuid>" }
curl -s -X DELETE -H "$AUTH" "$BASE/api/subjects/<subject-uuid>"    # → 200 { "id": "<subject-uuid>" } (members unfiled)
```

## The card field shape — get this right or you get a 400

Every card (in a note's `cards` array or a `POST /api/memory-cards` `cards` array) has exactly these fields:

| field     | rule                                                                                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`  | **required** string, trimmed, **10–2000 chars** (a 1-word cue is rejected). The question/recall cue. Rendered as markdown.                                                              |
| `example` | **required to be a string** — use `""` when none. **Markdown**: the answer revealed on review — prose, a fenced code snippet, or both. **Fence code** or it renders flat. Blank → null. |

**Do not send `null` for `example`** — it is validated as a string, so `null` is a `400`, not "no value".
Send `""`. Omitting `prompt`, or sending `cards` as anything but a non-empty array, is also a `400`.

## All text fields are markdown — fence your code

`content` (notes) and `example` (cards) are rendered with react-markdown + Shiki syntax highlighting.
**Code only highlights inside a fenced block** — ` ```lang … ``` `. Sending raw code with bare newlines
renders as one flattened paragraph: whitespace collapses, nothing is highlighted.

````jsonc
// ❌ flattens to a single grey line, no highlighting
{ "prompt": "Write a debounce wrapper.", "example": "function debounce(fn, d){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),d) } }" }

// ✅ prose scenario + a highlighted JS block, in the one example field
{
  "prompt": "Write a debounce wrapper and explain why the timer lives in the closure.",
  "example": "A search box collapsing rapid keystrokes into a single fetch.\n\n```js\nfunction debounce(fn, delay) {\n  let timer; // captured by the closure; survives across calls\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  };\n}\n```"
}
````

`example` is free markdown, so put the prose scenario and any fenced code snippet in the one field
(separate them with a blank line) — just **always fence code**, and tag the language (`js`, `ts`, `rust`,
`python`, …) so the right grammar highlights.

## Responses & limits

- **Success:** `200` for GETs, `PATCH`es, and `DELETE`s (returning `{ "id": ... }`); `201` for creates,
  returning `{ "id": ... }` (note/subject) or `{ "ids": [...] }` (cards).
- **`401`** — token missing, malformed, expired, or revoked. Re-check the `Authorization` header; mint a
  fresh token in Settings if it was revoked.
- **`404`** — the id in the path doesn't exist **or isn't yours** (the two are indistinguishable on
  purpose — the API never reveals whether another user's row exists). Applies to every `:id` route.
- **`400`** — malformed JSON, or a body that fails validation (card-shape rules, the `subject_id` XOR
  `subject_title` rule, or an invalid uuid in the path or query).
- **`500`** — unexpected server error.
- **`308`** — a path built with an **empty `:id` segment** (e.g. `DELETE /api/subjects/`) is redirected by
  trailing-slash normalization to the collection route, not rejected — you get a silent redirect, never a
  `404`. Never construct a `:id` URL with a missing id; validate the id before the call.
- **Caps:** ≤ 50 cards per note (`POST /api/notes` `cards`), 1–20 cards per `note_id` attach (`POST /api/memory-cards` `cards`), `prompt` 10–2000 chars,
  `title` ≤ 200 chars. Batch larger imports across multiple calls.

## Quick end-to-end smoke test

```bash
curl -s -H "$AUTH" "$BASE/api/subjects"                                              # 1. read structure
NOTE=$(curl -s -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d '{"note":{"title":"Smoke test","content":"# hi","subject_title":"Sandbox"},"cards":[{"prompt":"Does the API work?","example":""}]}' \
  "$BASE/api/notes")                                                                 # 2. create note + card
echo "$NOTE"                                                                          # → {"id":"..."}
ID=$(echo "$NOTE" | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
curl -s -X POST -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"note_id\":\"$ID\",\"cards\":[{\"prompt\":\"A second card?\",\"example\":\"\"}]}" \
  "$BASE/api/memory-cards"                                                            # 3. attach another card
curl -s -H "$AUTH" "$BASE/api/notes"                                                  # 4. confirm it's listed
```
