import { z } from 'zod'

import { MAX_DAILY_GOAL } from '@/features/settings/constants'

// Daily goal = target distinct cards reviewed per day. Two schemas for two layers — same
// string-vs-typed split as subjects' title (field validator) vs input (action contract):
//
// - dailyGoalFieldSchema: STRING input, for the form field validator. TanStack's StandardSchema
//   bridge requires the field value type (string) as the schema input, so a `z.coerce.number()`
//   (input `unknown`) can't validate the field. We validate the raw string and surface inline
//   messages; empty/non-integer/out-of-range are all rejected with no write.
// - dailyGoalSchema: the action contract — `{ dailyGoal: number }`, coerced + bounded. Mirrors
//   the DB `daily_goal > 0` check and the MAX_DAILY_GOAL cap as the server-side re-validation.
export const dailyGoalFieldSchema = z
  .string()
  .trim()
  .refine((v) => v !== '' && Number.isInteger(Number(v)), 'Must be a whole number')
  .refine((v) => Number(v) >= 1, 'Goal must be at least 1')
  .refine((v) => Number(v) <= MAX_DAILY_GOAL, `Goal must be ${MAX_DAILY_GOAL} or fewer`)

export const dailyGoalSchema = z.object({
  dailyGoal: z.coerce
    .number({ message: 'Enter a number' })
    .int('Must be a whole number')
    .min(1, 'Goal must be at least 1')
    .max(MAX_DAILY_GOAL, `Goal must be ${MAX_DAILY_GOAL} or fewer`),
})

export type DailyGoalInputT = z.infer<typeof dailyGoalSchema>
