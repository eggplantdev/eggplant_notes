-- S-02 attach-topic-checks: add the optional content fields FR-012 calls for.
-- `example` and `code_context` are both nullable (the FR marks them optional); `prompt`
-- stays the required question. RLS policies and the SM-2 scheduling columns are untouched
-- — the existing per-action memory_cards_*_own policies already gate the whole row, and the
-- SM-2 write path remains S-03's alone.

alter table memory_cards add column example text;
alter table memory_cards add column code_context text;
