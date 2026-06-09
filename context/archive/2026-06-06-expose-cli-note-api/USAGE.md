# CLI/agent HTTP API — usage (Phase 1, headless)

Personal-token API to read your structure and add notes/cards over HTTP. RLS-scoped to the token's
user; the server never accepts a `user_id` from the request. Phase 1 mints tokens by SQL (no UI yet).

## Mint a token

Tokens are stored **hash-only**. Generate a raw token + its SHA-256, give the raw value to the agent,
insert the hash for your user.

```bash
# 1) generate a token and its hash
node -e "const c=require('crypto');const raw='clc_'+c.randomBytes(32).toString('base64url');console.log('RAW  (give to the agent):',raw);console.log('HASH (insert below):    ',c.createHash('sha256').update(raw).digest('hex'))"
```

```sql
-- 2) insert the HASH for your user (Studio SQL editor or psql). Find your id: select id, email from auth.users;
insert into public.api_tokens (user_id, token_hash, name)
values ('<your-user-uuid>', '<HASH>', 'cli');

-- optional: expiry / later revocation
-- ... , expires_at => now() + interval '90 days'
-- revoke:  update public.api_tokens set revoked_at = now() where name = 'cli' and user_id = '<your-user-uuid>';
```

## Endpoints

Base URL = your app origin (local: `http://localhost:3000`). All requests send `Authorization: Bearer <RAW token>`.

```bash
TOKEN=clc_...

# list your subjects (topics)
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/subjects"
# → { "subjects": [ { "id": "...", "title": "..." } ] }

# list your notes (titles), optional ?subject=<uuid>
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/notes?subject=<uuid>"
# → { "notes": [ { "id": "...", "title": "...", "subject_id": "..." } ] }

# create a note (+ optional cards). subject_id (existing) OR subject_title (new), not both.
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"note":{"title":"My note","content":"# md","subject_title":"Rust"},"checks":[{"prompt":"What is ownership?","example":null,"code_context":null}]}' \
  "$BASE/api/notes"
# → 201 { "id": "<note-uuid>" }

# add cards to an existing note
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"note_id":"<note-uuid>","cards":[{"prompt":"Q?","example":null,"code_context":null}]}' \
  "$BASE/api/memory-cards"
# → 201 { "ids": ["<card-uuid>"] }

# add a standalone card (no note) under a subject (or subject_id:null = unfiled)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"prompt":"Q?","example":null,"code_context":null,"subject_id":null}' \
  "$BASE/api/memory-cards"
# → 201 { "ids": ["<card-uuid>"] }
```

Errors: `401` (missing/invalid/expired/revoked token), `400` (malformed JSON or invalid body), `500`
(unexpected). Caps: ≤50 checks per note, ≤20 cards per `note_id` insert, prompt ≤2000 chars.
