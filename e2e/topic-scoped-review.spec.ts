import { test, expect } from '@playwright/test'

import { clientFor, signUp, uniqueEmail } from './helpers'

// Topic-scoped review on /memory-cards (test-plan §3 Phase-debt; change topic-scoped-review,
// archived 2026-06-09). RISK: the Review PANEL on the listing page must scope its due queue to the
// active filters — not the global queue the dashboard uses. This crosses boundaries the layers
// below can't prove together: the filter searchParams → getDueQueue(opts) → ReviewPanel →
// rateMemoryCard → revalidatePath('/', 'layout') → the NEXT filtered-due card on SSR re-render.
// The list filter is already covered (memory-card-filters.spec.ts); the panel's getDueQueue scoping
// is NOT — and a regression there is invisible to unit/integration.
//
// Construction that makes the scoping proof airtight: subject B's card is the MOST-overdue, so it is
// the GLOBAL soonest-due — an UNSCOPED panel would surface it. After filtering to subject A, B's
// prompt can only appear via the panel (the list is filtered to A), so its ABSENCE proves the panel
// is filtered too. The panel's subtitle ("· N cards due") is unique to the panel (the list has no
// such text), so it tracks the FILTERED due count independent of the list — count 3→2 on filter, and
// 2→1→caught-up on rating, is the in-filter advance. Self-seeds via real UI sign-up (auth path) +
// three standalone cards through an authenticated client (controlled subject_id + due_at, the data
// we assert on). Locators: testid for the filter, unique seeded prompts + the panel subtitle for
// state — never copy (lessons.md selector discipline).

test('topic-scoped review: panel scopes its due queue to the subject filter and advances in-filter', async ({
  page,
}) => {
  const email = uniqueEmail('mc-scoped-review')
  await signUp(page, email)
  const stamp = Date.now()

  const subjA = `Subject A ${stamp}`
  const subjB = `Subject B ${stamp}`
  const promptA1 = `Alpha one ${stamp}`
  const promptA2 = `Alpha two ${stamp}`
  const promptB1 = `Bravo one ${stamp}`

  // Two subjects (user_id defaults to auth.uid(); RLS-scoped to this account).
  const supabase = await clientFor(email)
  const { data: subjects, error: subjErr } = await supabase
    .from('subjects')
    .insert([{ title: subjA }, { title: subjB }])
    .select('id, title')
  expect(subjErr, 'subject seed failed').toBeNull()
  const idA = subjects?.find((s) => s.title === subjA)?.id
  const idB = subjects?.find((s) => s.title === subjB)?.id
  expect(idA && idB, 'seeded both subject ids').toBeTruthy()

  // Three due standalone cards (note_id null). due_at staggered into the past: B1 oldest → globally
  // soonest-due (the "intruder" the filter must exclude); A1 older than A2 → A's own soonest.
  const minsAgo = (m: number) => new Date(stamp - m * 60_000).toISOString()
  const { error: cardErr } = await supabase.from('memory_cards').insert([
    { prompt: promptB1, subject_id: idB, due_at: minsAgo(30) },
    { prompt: promptA1, subject_id: idA, due_at: minsAgo(20) },
    { prompt: promptA2, subject_id: idA, due_at: minsAgo(10) },
  ])
  expect(cardErr, 'card seed failed').toBeNull()

  // No filter → the panel reads the GLOBAL due queue: its subtitle reports all 3 due, and the
  // most-overdue B1 is what an unscoped queue surfaces. (Subtitle text is unique to the panel.)
  await page.goto('/memory-cards')
  await expect(page.getByText('Reviewing all due cards', { exact: false })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('3 cards due', { exact: false })).toBeVisible()

  // Filter to subject A.
  await page.getByTestId('filter-subjects').click()
  await page.getByTestId(`filter-subjects-option-${idA}`).click()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(new RegExp(`[?&]subjects=${idA}(&|$)`), { timeout: 15_000 })

  // The panel is now A-scoped: subtitle switches to the filtered copy and the count drops 3→2
  // (A's two due cards). B1 has vanished from the WHOLE page — the list is A-only, so its absence
  // can only mean the panel's due queue is filtered too (the scoping proof). A due A-card is shown
  // (Good present, not caught-up).
  await expect(
    page.getByText('Reviewing due cards that match your filters', { exact: false }),
  ).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('2 cards due', { exact: false })).toBeVisible()
  await expect(page.getByText(promptB1)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Good/ })).toBeVisible()

  // Rate the soonest A card → revalidate → advance IN-FILTER to the other A card. Filtered count
  // drops 2→1; B1 still absent (advance never reaches into subject B).
  await page.getByRole('button', { name: /Good/ }).click()
  await expect(page.getByText('1 card due', { exact: false })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(promptB1)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Good/ })).toBeVisible()

  // Rate the last A card → A's filtered due count hits 0 → the panel drops the count and shows the
  // "All caught up — reviewing ahead" note IN PLACE (review-ahead keeps the user unblocked instead of
  // dead-ending). The list survives beneath it (gate total>0: A's cards still exist, just not due),
  // and B1 is still nowhere.
  await page.getByRole('button', { name: /Good/ }).click()
  await expect(page.getByText('All caught up', { exact: false })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(promptB1)).toHaveCount(0)
  // The list survives beneath the panel. Cards aren't links now — the A1 list card is the
  // [data-slot=card] carrying a Review button (the panel card has none), so this picks the list row.
  await expect(
    page
      .locator('[data-slot="card"]')
      .filter({ hasText: promptA1 })
      .filter({ has: page.getByRole('button', { name: 'Review' }) }),
  ).toBeVisible()
})
