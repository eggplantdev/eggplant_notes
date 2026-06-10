import { z } from 'zod'

// Password is optional in the schema, required by the action only on a non-empty account: the
// empty-account fast path loads with no ceremony, while a wipe-then-load demands the step-up
// re-auth password (the action enforces presence — see load-sample-data.ts).
export const loadSampleDataSchema = z.object({
  password: z.string().optional(),
})

export type LoadSampleDataT = z.infer<typeof loadSampleDataSchema>
