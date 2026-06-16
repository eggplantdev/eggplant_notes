// Deterministic, fence-aware markdown → notes splitter (Phase 1, no AI). Generalizes the H1-only
// `parseNoteSections` in supabase/seed-scripts/generate-section-seed.mjs to a caller-chosen level so
// docs that use `#` for a title + `##` for sections split where the user actually wants.

export type SplitLevelT = 1 | 2 | 3

export type SplitSectionT = {
  title: string
  content: string
}

const FENCE = /^\s*```/

// Title given to content that appears before the first heading at the chosen level (or to a doc with
// no such headings at all) — nothing is dropped; the user retitles/skips it in the preview.
const LEADING_TITLE = 'Untitled'

// An exact-level heading: `level` `#`s then whitespace then a non-space. A deeper heading (`###` for
// level 2) has a `#` where this wants whitespace; a shallower one has whitespace where this wants `#`
// — so the match is exactly the requested depth, never a prefix of a deeper one.
function headingMatcher(level: SplitLevelT): RegExp {
  return new RegExp(`^#{${level}}\\s+\\S`)
}

// The matched heading text drives the note `title`, so it is NOT repeated in `content` (the note
// renders its title separately; the seed generator follows the same convention).
// Deeper headings and all other lines stay in `content`.
export function splitMarkdown(md: string, level: SplitLevelT): SplitSectionT[] {
  const isHeading = headingMatcher(level)
  const lines = md.split('\n')
  const sections: { title: string; body: string[] }[] = []
  let inFence = false
  let current: { title: string; body: string[] } | undefined

  for (const line of lines) {
    if (FENCE.test(line)) inFence = !inFence

    if (!inFence && isHeading.test(line)) {
      if (current) sections.push(current)
      current = { title: line.replace(/^#+\s+/, '').trim(), body: [] }
      continue
    }

    if (!current) {
      // Pre-heading content: open a leading untitled section lazily so an empty preamble adds nothing.
      current = { title: LEADING_TITLE, body: [] }
    }
    current.body.push(line)
  }
  if (current) sections.push(current)

  return (
    sections
      .map((s) => ({ title: s.title, content: s.body.join('\n').trim() }))
      // Drop a fully-empty leading block (whitespace-only preamble); keep title-only matched sections.
      .filter((s) => s.title !== LEADING_TITLE || s.content.length > 0)
  )
}
