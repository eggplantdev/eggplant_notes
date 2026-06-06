import type {
  CardStatRowT,
  DashboardStatsT,
  HardestCardT,
  NoteStatRowT,
  RatingStatRowT,
} from '@/features/dashboard/types'
import { APP_TIME_ZONE, isoDateInZone, MS_PER_DAY, toISODate } from '@/lib/utils'

// Pure aggregation for the dashboard's expanded stats. Kept synchronous and Supabase-free
// (mirrors streak.ts) so it stays unit-testable in isolation — the data layer fetches the
// rows, this turns them into the DashboardStatsT contract the UI renders.
//
// All day math runs in the UTC-midnight space the heatmap uses: `today` is todayInZone(...)
// (UTC midnight of the zone's calendar date), and each timestamp is bucketed to its zone date
// before comparing. ISO YYYY-MM-DD strings compare correctly with `<`/`===`.

type InputT = {
  cards: CardStatRowT[]
  notes: NoteStatRowT[]
  ratings: RatingStatRowT[]
  today: Date
}

const HARDEST_LIMIT = 5

export function computeDashboardStats(input: InputT): DashboardStatsT {
  const { cards, notes, ratings, today } = input

  const todayStr = toISODate(today.getTime())

  let overdue = 0
  for (const c of cards) {
    const dueStr = isoDateInZone(new Date(c.due_at), APP_TIME_ZONE)
    if (dueStr < todayStr) overdue += 1
  }

  const hardestCards = buildHardest(cards, notes)

  // Review-quality stats over the fetched window — one pass for good + this-week.
  const total = ratings.length
  const weekStartStr = toISODate(today.getTime() - 6 * MS_PER_DAY)
  let good = 0
  let reviewsThisWeek = 0
  for (const r of ratings) {
    if (r.rating >= 3) good += 1
    if (isoDateInZone(new Date(r.reviewed_at), APP_TIME_ZONE) >= weekStartStr) reviewsThisWeek += 1
  }

  return {
    overdue,
    reviewsInWindow: total,
    reviewsThisWeek,
    retention: total > 0 ? good / total : null,
    hardestCards,
  }
}

// Top cards by lapse count (ties broken by lower stability = shakier), titled via the note map.
function buildHardest(cards: CardStatRowT[], notes: NoteStatRowT[]): HardestCardT[] {
  const titleByNote = new Map(notes.map((n) => [n.id, n.title ?? 'Untitled']))
  return cards
    .filter((c) => c.lapses > 0)
    .sort((a, b) => b.lapses - a.lapses || a.stability - b.stability)
    .slice(0, HARDEST_LIMIT)
    .map((c) => ({
      id: c.id,
      prompt: c.prompt,
      noteId: c.note_id,
      noteTitle: (c.note_id ? titleByNote.get(c.note_id) : null) ?? 'Untitled',
      lapses: c.lapses,
      stability: c.stability,
    }))
}
