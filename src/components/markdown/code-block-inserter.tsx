'use client'

import { CODE_LANGUAGES } from '@/components/markdown/code-languages'
import { Combobox } from '@/components/ui/combobox'

function appendCodeBlock(content: string, lang: string) {
  const block = '```' + lang + '\n\n```\n'
  if (!content) return block
  // Strip trailing newlines, re-add one blank line, so the fence always opens on its own blank line.
  return content.replace(/\n+$/, '') + '\n\n' + block
}

type CodeBlockInserterPropsT = {
  value: string
  onChange: (next: string) => void
  className?: string
}

// No bound `value` on the Combobox, so re-selecting the same language appends another block.
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
