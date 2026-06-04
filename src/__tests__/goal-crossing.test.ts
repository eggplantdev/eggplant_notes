import { describe, expect, it } from 'vitest'

import { detectGoalCrossing } from '@/features/review/detect-goal-crossing'

// goal=5 → weeklyGoal=35. Helper returns undefined when nothing crossed, else the payload.
const base = { dailyBefore: 0, dailyAfter: 0, weeklyBefore: 0, weeklyAfter: 0, dailyGoal: 5 }

describe('detectGoalCrossing', () => {
  it('returns undefined when neither goal is crossed', () => {
    expect(
      detectGoalCrossing({
        ...base,
        dailyBefore: 2,
        dailyAfter: 3,
        weeklyBefore: 2,
        weeklyAfter: 3,
      }),
    ).toBeUndefined()
  })

  it('flags a daily-only crossing (4 → 5)', () => {
    const r = detectGoalCrossing({
      ...base,
      dailyBefore: 4,
      dailyAfter: 5,
      weeklyBefore: 10,
      weeklyAfter: 11,
    })
    expect(r).toEqual({
      daily: true,
      weekly: false,
      dailyCount: 5,
      weeklyCount: 11,
      dailyGoal: 5,
      weeklyGoal: 35,
    })
  })

  it('flags a weekly-only crossing (34 → 35)', () => {
    const r = detectGoalCrossing({
      ...base,
      dailyBefore: 6,
      dailyAfter: 7,
      weeklyBefore: 34,
      weeklyAfter: 35,
    })
    expect(r).toEqual({
      daily: false,
      weekly: true,
      dailyCount: 7,
      weeklyCount: 35,
      dailyGoal: 5,
      weeklyGoal: 35,
    })
  })

  it('flags both when one rating crosses both (combined dialog)', () => {
    const r = detectGoalCrossing({
      ...base,
      dailyBefore: 4,
      dailyAfter: 5,
      weeklyBefore: 34,
      weeklyAfter: 35,
    })
    expect(r?.daily).toBe(true)
    expect(r?.weekly).toBe(true)
  })

  it('does not re-fire daily when already at/over goal (re-review keeps count flat)', () => {
    expect(
      detectGoalCrossing({
        ...base,
        dailyBefore: 5,
        dailyAfter: 5,
        weeklyBefore: 5,
        weeklyAfter: 5,
      }),
    ).toBeUndefined()
  })

  it('does not fire daily when already over goal (5 → 6)', () => {
    expect(
      detectGoalCrossing({
        ...base,
        dailyBefore: 5,
        dailyAfter: 6,
        weeklyBefore: 5,
        weeklyAfter: 6,
      }),
    ).toBeUndefined()
  })

  it('guards goal <= 0', () => {
    expect(
      detectGoalCrossing({
        dailyBefore: 0,
        dailyAfter: 1,
        weeklyBefore: 0,
        weeklyAfter: 1,
        dailyGoal: 0,
      }),
    ).toBeUndefined()
  })
})
