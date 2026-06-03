'use client'

import { CODE_LANGUAGES } from '@/components/markdown/code-languages'
import { Combobox } from '@/components/ui/combobox'

// Appends an empty fenced code block in `lang` to a markdown value, normalizing the gap so the
// fence always opens on its own blank line. Pure — the result is fed back to the field.
function appendCodeBlock(content: string, lang: string) {
  const block = '```' + lang + '\n\n```\n'
  if (!content) return block
  // Strip trailing newlines then re-add exactly one blank line, so the fence always opens on
  // its own blank line regardless of how the body currently ends.
  return content.replace(/\n+$/, '') + '\n\n' + block
}

type CodeBlockInserterPropsT = {
  value: string
  onChange: (next: string) => void
  className?: string
}

// Action-style language picker that appends a fenced code block to a MarkdownEditor's value.
// No bound `value` on the Combobox, so re-selecting the same language appends another block.
// Pairs with any MarkdownEditor field — the note body and topic-check code context.
export function CodeBlockInserter({
  value,
  onChange,
  className = 'w-48',
}: CodeBlockInserterPropsT) {
  return (
    <Combobox
      options={CODE_LANGUAGES}
      onChange={(lang) => onChange(appendCodeBlock(value, lang))}
      placeholder="Insert code block…"
      searchPlaceholder="Search language…"
      emptyMessage="No language found."
      className={className}
    />
  )
}
