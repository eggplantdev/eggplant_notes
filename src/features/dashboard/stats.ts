import { FORECAST_DAYS, MATURE_STABILITY_DAYS } from '@/features/dashboard/constants'
import { getLongestStreak } from '@/features/review-events/streak'
import type {
  CheckStatRowT,
  DashboardStatsT,
  HardestCardT,
  NoteStatRowT,
  RatingStatRowT,
  SubjectRollupT,
} from '@/features/dashboard/types'
import { APP_TIME_ZONE, isoDateInZone, MS_PER_DAY, toISODate } from '@/lib/utils'
import type { ActivityDayT } from '@/types/activity'

// Pure aggregation for the dashboard's expanded stats. Kept synchronous and Supabase-free
// (mirrors streak.ts) so it stays unit-testable in isolation — the data layer fetches the
// rows, this turns them into the DashboardStatsT contract the UI renders.
//
// All day math runs in the UTC-midnight space the heatmap uses: `today` is todayInZone(...)
// (UTC midnight of the zone's calendar date), and each timestamp is bucketed to its zone date
// before comparing. ISO YYYY-MM-DD strings compare correctly with `<`/`===`.

type InputT = {
  checks: CheckStatRowT[]
  notes: NoteStatRowT[]
  subjects: { id: string; title: string }[]
  ratings: RatingStatRowT[]
  activity: ActivityDayT[]
  today: Date
}

const HARDEST_LIMIT = 5

export function computeDashboardStats(input: InputT): DashboardStatsT {
  const { checks, notes, subjects, ratings, activity, today } = input

  const todayStr = toISODate(today.getTime())
  // Forecast day buckets: index 0 = today (folds in overdue), 1..N = each upcoming day.
  const forecastDates = Array.from({ length: FORECAST_DAYS }, (_, i) =>
    toISODate(today.getTime() + i * MS_PER_DAY),
  )
  const dueForecast = forecastDates.map((date) => ({ date, count: 0 }))
  // date → bucket index, so the per-check assignment is an O(1) lookup, not an indexOf scan.
  const forecastIdx = new Map(forecastDates.map((date, i) => [date, i]))

  const stateCounts = { new: 0, learning: 0, review: 0, relearning: 0 }
  const stateKeys = ['new', 'learning', 'review', 'relearning'] as const
  const cardsByNote = new Map<string, number>()
  const dueByNote = new Map<string, number>()
  let overdue = 0
  let matureCards = 0
  let totalLapses = 0

  for (const c of checks) {
    if (c.state >= 0 && c.state < stateKeys.length) stateCounts[stateKeys[c.state]] += 1
    cardsByNote.set(c.note_id, (cardsByNote.get(c.note_id) ?? 0) + 1)
    if (c.stability >= MATURE_STABILITY_DAYS) matureCards += 1
    totalLapses += c.lapses

    const dueStr = isoDateInZone(new Date(c.due_at), APP_TIME_ZONE)
    if (dueStr <= todayStr) {
      overdue += dueStr < todayStr ? 1 : 0
      dueForecast[0].count += 1 // today + overdue land in the first bar
      dueByNote.set(c.note_id, (dueByNote.get(c.note_id) ?? 0) + 1)
    } else {
      // idx is never 0 here (today's cards took the branch above), so a defined idx is upcoming.
      const idx = forecastIdx.get(dueStr)
      if (idx !== undefined) dueForecast[idx].count += 1
    }
  }

  const hardestCards = buildHardest(checks, notes)

  const subjectRollup = buildSubjectRollup(subjects, notes, cardsByNote, dueByNote)

  // Review-quality stats over the fetched window — one pass for good/again/this-week.
  const total = ratings.length
  const weekStartStr = toISODate(today.getTime() - 6 * MS_PER_DAY)
  let good = 0
  let again = 0
  let reviewsThisWeek = 0
  for (const r of ratings) {
    if (r.rating >= 3) good += 1
    if (r.rating === 1) again += 1
    if (isoDateInZone(new Date(r.reviewed_at), APP_TIME_ZONE) >= weekStartStr) reviewsThisWeek += 1
  }

  return {
    totalCards: checks.length,
    totalNotes: notes.length,
    totalSubjects: subjects.length,
    stateCounts,
    overdue,
    dueForecast,
    matureCards,
    youngCards: checks.length - matureCards,
    totalLapses,
    reviewsInWindow: total,
    reviewsThisWeek,
    retention: total > 0 ? good / total : null,
    lapseRate: total > 0 ? again / total : null,
    longestStreak: getLongestStreak(activity),
    hardestCards,
    subjectRollup,
  }
}

// Top cards by lapse count (ties broken by lower stability = shakier), titled via the note map.
function buildHardest(checks: CheckStatRowT[], notes: NoteStatRowT[]): HardestCardT[] {
  const titleByNote = new Map(notes.map((n) => [n.id, n.title ?? 'Untitled']))
  return checks
    .filter((c) => c.lapses > 0)
    .sort((a, b) => b.lapses - a.lapses || a.stability - b.stability)
    .slice(0, HARDEST_LIMIT)
    .map((c) => ({
      id: c.id,
      prompt: c.prompt,
      noteId: c.note_id,
      noteTitle: titleByNote.get(c.note_id) ?? 'Untitled',
      lapses: c.lapses,
      stability: c.stability,
    }))
}

// Per-subject note/card/due counts, plus a synthetic "No subject" bucket for unassigned notes.
// Notes are grouped by subject once (null key = unassigned) so each subject's tally is a Map
// lookup, not an O(subjects×notes) re-scan of the whole note set.
function buildSubjectRollup(
  subjects: { id: string; title: string }[],
  notes: NoteStatRowT[],
  cardsByNote: Map<string, number>,
  dueByNote: Map<string, number>,
): SubjectRollupT[] {
  const notesBySubject = new Map<string | null, NoteStatRowT[]>()
  for (const n of notes) {
    const list = notesBySubject.get(n.subject_id)
    if (list) list.push(n)
    else notesBySubject.set(n.subject_id, [n])
  }

  const tally = (id: string | null, title: string): SubjectRollupT => {
    const members = notesBySubject.get(id) ?? []
    let cards = 0
    let due = 0
    for (const n of members) {
      cards += cardsByNote.get(n.id) ?? 0
      due += dueByNote.get(n.id) ?? 0
    }
    return { id, title, notes: members.length, cards, due }
  }

  const rows = subjects.map((s) => tally(s.id, s.title))
  const orphan = tally(null, 'No subject')
  return orphan.notes > 0 ? [...rows, orphan] : rows
}
