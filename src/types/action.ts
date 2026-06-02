// Discriminated result returned by Server Actions so forms can render inline errors.
export type ActionResultT = { success: true } | { success: false; error: string }
