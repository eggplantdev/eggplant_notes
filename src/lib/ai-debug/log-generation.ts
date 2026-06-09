import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

import type { UsageT } from '@/features/openrouter/types'
import { toISODate } from '@/lib/utils'

// Always-on generation log for prompt refinement (no NODE_ENV gate). Two channels:
//   1. console.log — structured, works everywhere (visible in `vercel logs`).
//   2. file append (jsonl + md) — best-effort. The serverless FS is read-only outside /tmp, so the
//      write throws in prod; we swallow it. Locally it accumulates one entry per generation under a
//      gitignored dir, giving a diffable history across prompt revisions.
// Lives at a stable top-level `.ai-debug/`, NOT under the change folder — that folder becomes
// immutable when the slice is archived, which would silently kill the file channel.
const LOG_DIR = path.join(process.cwd(), '.ai-debug')

export type GenerationLogT = {
  task: 'cards' | 'notes'
  model: string
  system: string
  prompt: string
  output: unknown
  usage: UsageT
  latencyMs: number
  // How many items were dropped as incomplete (blank required field) before returning. Surfaced so a
  // silent drop is visible in the log even though the user only sees the kept items.
  droppedCount?: number
}

export async function logGeneration(entry: GenerationLogT): Promise<void> {
  // The console channel is the always-reliable one; the dialog also shows usage to the user.
  console.log('[ai-generation]', {
    task: entry.task,
    model: entry.model,
    usage: entry.usage,
    latencyMs: entry.latencyMs,
    ...(entry.droppedCount ? { droppedCount: entry.droppedCount } : {}),
  })

  try {
    const day = toISODate(Date.now())
    await mkdir(LOG_DIR, { recursive: true })
    // The two channels write to different files — append them concurrently.
    await Promise.all([
      appendFile(
        path.join(LOG_DIR, `${day}.jsonl`),
        JSON.stringify({ ...entry, at: new Date().toISOString() }) + '\n',
        'utf8',
      ),
      appendFile(path.join(LOG_DIR, `${day}.md`), renderMarkdownEntry(entry), 'utf8'),
    ])
  } catch {
    // Read-only FS (prod) or any IO error — console + the dialog already carried the signal.
  }
}

function renderMarkdownEntry(entry: GenerationLogT): string {
  const { task, model, usage, latencyMs, system, prompt, output, droppedCount } = entry
  return [
    `## ${new Date().toISOString()} · ${task} · ${model}`,
    '',
    `- tokens: in ${usage.inputTokens ?? '?'} / out ${usage.outputTokens ?? '?'} / total ${usage.totalTokens ?? '?'} · ${latencyMs}ms${droppedCount ? ` · dropped ${droppedCount}` : ''}`,
    '',
    '**System**',
    '',
    '```',
    system,
    '```',
    '',
    '**Prompt**',
    '',
    '```',
    prompt,
    '```',
    '',
    '**Output**',
    '',
    '```json',
    JSON.stringify(output, null, 2),
    '```',
    '',
    '---',
    '',
  ].join('\n')
}
