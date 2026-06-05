import { test, expect } from '@playwright/test'

import { attachCheck, clientFor, createNote, signUp, uniqueEmail } from './helpers'

// S-03 north-star path: the recall loop end-to-end (FR-016–019). Sign up → create a note →
// attach a topic check → open /dashboard (the review panel lives here now) → rate it → assert
// the check leaves the queue AND that the schedule/event actually changed in the DB
// (review_events row written, due_at pushed to
// the future). Plus cross-account RLS on the review read + rate paths. Shared helpers in
// ./helpers (the read/rate helpers can't be imported into a raw spec — @/ alias + server-only
// next/headers don't resolve outside the Next runtime, see lessons.md — so DB assertions use a
// signInWithPassword client). Treat any sign-up flake as environmental (lessons.md).

// FSRS Rating: Good = 3.
const GOOD = 3

test('full loop: review a due check, rate Good, and the schedule + event change', async ({
  page,
}) => {
  const email = uniqueEmail('rev-loop')
  await signUp(page, email)

  // A note + a fresh topic check (due_at defaults to now → immediately due).
  await createNote(page, `Review host ${Date.now()}`)
  const prompt = `What is a closure? ${Date.now()}`
  await attachCheck(page, prompt)

  // The dashboard's review panel shows the question + four rating buttons, each with an interval preview.
  await page.goto('/dashboard')
  await expect(page.getByText(prompt)).toBeVisible()
  for (const label of ['Again', 'Hard', 'Good', 'Easy']) {
    const button = page.getByRole('button', { name: new RegExp(label) })
    await expect(button).toBeVisible()
    await expect(button, `${label} should show an interval preview`).toContainText(/\d/)
  }

  // Rate Good → the queue empties (only one check) → "All caught up".
  await page.getByRole('button', { name: /Good/ }).click()
  await expect(page.getByText('All caught up', { exact: false })).toBeVisible({ timeout: 15_000 })

  // The schedule + event actually changed: one review_event (rating 3), due_at now in the future.
  const supa = await clientFor(email)
  const checks = await supa.from('topic_checks').select('id, due_at')
  expect(checks.error).toBeNull()
  expect(checks.data?.length, 'one check exists').toBe(1)
  const check = checks.data![0]
  expect(new Date(check.due_at).getTime(), 'due_at rescheduled into the future').toBeGreaterThan(
    Date.now(),
  )

  const events = await supa.from('review_events').select('rating').eq('topic_check_id', check.id)
  expect(events.error).toBeNull()
  expect(events.data?.length, 'one review_event recorded').toBe(1)
  expect(events.data?.[0].rating, 'recorded the Good grade').toBe(GOOD)
})

// RLS on the review path: account B can neither see nor rate account A's checks. B's dashboard
// review panel is empty even though A has a due check, and calling record_review against A's id writes nothing
// (the RPC's update-first ownership guard matches 0 rows under RLS → raises → no event).
test('review path is isolated by account', async ({ browser }) => {
  const emailA = uniqueEmail('rev-iso-a')
  const emailB = uniqueEmail('rev-iso-b')

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  await signUp(await ctxA.newPage(), emailA)
  const pageB = await ctxB.newPage()
  await signUp(pageB, emailB)
  await ctxA.close()

  const supaA = await clientFor(emailA)
  const supaB = await clientFor(emailB)

  // A seeds a note + a due topic check.
  const note = await supaA
    .from('notes')
    .insert({ title: `iso note ${Date.now()}` })
    .select('id')
    .single()
  expect(note.error, 'A note insert failed').toBeNull()
  const tc = await supaA
    .from('topic_checks')
    .insert({ note_id: note.data!.id, prompt: 'A only prompt' })
    .select('id')
    .single()
  expect(tc.error, 'A topic_check insert failed').toBeNull()
  const aCheckId = tc.data!.id

  // B opens /dashboard → "All caught up" (A's due check is hidden by RLS, not visible to B).
  await pageB.goto('/dashboard')
  await expect(pageB.getByText('All caught up', { exact: false })).toBeVisible({ timeout: 15_000 })
  await ctxB.close()

  // B tries to rate A's check directly → rejected by the RPC's ownership guard.
  const rpc = await supaB.rpc('record_review', {
    p_topic_check_id: aCheckId,
    p_rating: GOOD,
    p_card: {
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 1,
      learning_steps: 0,
      reps: 1,
      lapses: 0,
      state: 2,
      due: new Date(Date.now() + 86_400_000).toISOString(),
      last_review: new Date().toISOString(),
    },
  })
  expect(rpc.error, 'B rating A check should be rejected').not.toBeNull()

  // Nothing was written: A's check has no review_events.
  const events = await supaA.from('review_events').select('id').eq('topic_check_id', aCheckId)
  expect(events.error).toBeNull()
  expect(events.data?.length, 'LEAK: B wrote a review_event on A check').toBe(0)
})
