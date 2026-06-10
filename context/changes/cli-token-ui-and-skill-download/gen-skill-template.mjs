// Regenerates src/features/api-tokens/skill-template.ts from the human-readable skill markdown.
// The .md is the source of truth; the .ts is a byte-exact bundled mirror (emitted via JSON.stringify
// so the markdown's backticks / ${...} can't break a TS template literal). Run from the repo root:
//   node context/changes/cli-token-ui-and-skill-download/gen-skill-template.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'context/changes/cli-token-ui-and-skill-download/clc-note-api.skill.md'
const OUT = 'src/features/api-tokens/skill-template.ts'

const md = readFileSync(SRC, 'utf8')

const header = `// The agent skill served by GET /api/skill, with {{CLC_BASE_URL}} replaced by the deployment origin.
//
// SOURCE OF TRUTH is the human-readable markdown at
//   ${SRC}
// This file is a GENERATED, byte-exact mirror of it (a bundled string, so Vercel output-tracing can't
// drop it the way it could an fs.readFile of a non-imported .md). The markdown carries backticks and
// \`\${...}\` that would break a TS template literal, so the mirror is emitted via JSON.stringify rather
// than hand-escaped. Regenerate after editing the .md:
//   node context/changes/cli-token-ui-and-skill-download/gen-skill-template.mjs
// A unit test pins the placeholder + documented endpoints so drift fails CI.

export const CLC_BASE_URL_PLACEHOLDER = '{{CLC_BASE_URL}}'

export const CLC_SKILL_TEMPLATE = ${JSON.stringify(md)}
`

writeFileSync(OUT, header)
console.log(`wrote ${OUT} (${md.length} chars of markdown)`)
