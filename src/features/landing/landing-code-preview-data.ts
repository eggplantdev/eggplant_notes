// A hand-coloured snippet for the code-preview card — no client highlighter on the marketing page.
// Each token is [text, kind]; '' = inherit the base colour. Kinds map to the brand neon ramp in TOKEN_COLOR.
export const CODE_LINES = [
  [['// Remove duplicates, keep first occurrence', 'com']],
  [
    ['export function ', 'kw'],
    ['unique', 'fn'],
    ['(items: ', ''],
    ['string', 'fn'],
    ['[]) {', ''],
  ],
  [
    ['  ', ''],
    ['return ', 'kw'],
    ['[...', ''],
    ['new ', 'kw'],
    ['Set', 'fn'],
    ['(items)]', ''],
  ],
  [['}', '']],
  [
    ['unique', 'fn'],
    ['([', ''],
    ['"a"', 'str'],
    [', ', ''],
    ['"b"', 'str'],
    [', ', ''],
    ['"a"', 'str'],
    ['])  ', ''],
    ['// result: ["a", "b"]', 'com'],
  ],
] as const

export const TOKEN_COLOR: Record<string, string> = {
  kw: 'text-neon-fuchsia',
  fn: 'text-neon-cyan',
  str: 'text-neon-green',
  com: 'text-muted-foreground italic',
}
