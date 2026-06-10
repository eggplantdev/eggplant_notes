# Subjects view polish — TODO

Brain-dump backlog for the new Subjects detail view. Items captured as raised; not yet sequenced or planned.

## Layout / buttons

- [x] **Move "New subject" button** — out of the top-left (next to the subject `<select>`) and over to the top-right, sitting next to **Edit subject** / **Delete subject**. _(eyebrow → actions, layout.tsx)_
- [x] **"Add note to this subject" button color** — match the other "add note" buttons. Dropped `variant="outline"` → default variant (`bg-primary`, near-white in dark mode), same as the `/notes` "New note" buttons.
- [x] **Subject select** — wider: `w-48` → `w-72` (subject-switcher.tsx). _Height left at Combobox default — bump if "larger" meant taller too._

- [x] ~~**Add note button** — `w-fit`~~ / ~~**Mobile: add-note next to "Notes" dropdown**~~ — both **superseded**: add-note moved out of the sidebar entirely (see below).
- [x] **Notes list grows to fit** — sidebar grid track `15rem` → `fit-content(24rem)` so it widens to the longest title (capped 24rem), with `md:min-w-60` floor. Titles no longer truncate when there's room.
- [x] **Move "Add note to this subject" → subject header** — relocated into the PageShell `actions` row, last (after Delete subject), default (white-ish) variant. Removed from the sidebar wrapper; mobile now shows it in the header actions, not beside the "Notes" trigger.

## Open / unsorted

_(next brain-dump items land here)_
