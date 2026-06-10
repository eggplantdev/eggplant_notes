// Deterministic client-JS bundle measurement, tool-agnostic (works for webpack OR turbopack output).
// Sums raw + gzipped bytes of every emitted client chunk. Gzipped ≈ what actually ships over the wire.
// Usage: node measure-chunks.mjs <distDir>   e.g. node measure-chunks.mjs .next-perf
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const dist = process.argv[2] || '.next-perf'
const chunkDir = join(dist, 'static', 'chunks')

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (e.name.endsWith('.js')) out.push(p)
  }
  return out
}

const files = walk(chunkDir)
let raw = 0
let gz = 0
const perFile = []
for (const f of files) {
  const buf = readFileSync(f)
  const g = gzipSync(buf).length
  raw += buf.length
  gz += g
  perFile.push({ file: f.replace(dist + '/static/chunks/', ''), raw: buf.length, gz: g })
}

perFile.sort((a, b) => b.gz - a.gz)
const kb = (n) => (n / 1024).toFixed(1) + ' kB'

console.log(`distDir: ${dist}`)
console.log(`chunk files: ${files.length}`)
console.log(`TOTAL raw:      ${kb(raw)}`)
console.log(`TOTAL gzipped:  ${kb(gz)}   <-- shipped bytes`)
console.log(`\nTop 15 chunks by gzipped size:`)
for (const f of perFile.slice(0, 15)) {
  console.log(`  ${kb(f.gz).padStart(12)}  ${f.file}`)
}
