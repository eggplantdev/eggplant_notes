// Hard ceiling for a single generation call. Past this the abort fires and the dialog surfaces a
// timeout message instead of spinning "Generating…" forever on a hung model.
export const GENERATION_TIMEOUT_MS = 60_000
