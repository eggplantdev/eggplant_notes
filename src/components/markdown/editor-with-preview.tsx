'use client'

import { useState } from 'react'

import { CodeBlockInserter } from '@/components/markdown/code-block-inserter'
import { MarkdownEditor } from '@/components/markdown/markdown-editor'
import { MarkdownPreview } from '@/components/markdown/markdown-preview'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type MobileTabT = 'write' | 'preview'

// The full markdown editing surface with everything baked in: the CodeBlockInserter toolbar, the
// CodeMirror editor, and the live preview side by side (md+). On mobile there's no room for two
// columns, so a Write/Preview tab toggles which one shows. Shared by NoteForm (the note body) and
// CardForm (a card's code context) so the layout can't drift between them — `MarkdownEditor` and
// `MarkdownPreview` are the lower-level primitives; this pairs them. `value`/`onChange` come from
// the consuming form's field; the inserter and preview both read/write that same value.
export function EditorWithPreview({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [mobileTab, setMobileTab] = useState<MobileTabT>('write')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <CodeBlockInserter value={value} onChange={onChange} />
        <div className="ml-auto flex gap-2 md:hidden" role="tablist">
          <Button
            type="button"
            size="sm"
            variant={mobileTab === 'write' ? 'default' : 'outline'}
            onClick={() => setMobileTab('write')}
          >
            Write
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mobileTab === 'preview' ? 'default' : 'outline'}
            onClick={() => setMobileTab('preview')}
          >
            Preview
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={cn('min-w-0', mobileTab === 'write' ? 'block' : 'hidden', 'md:block')}>
          <MarkdownEditor value={value} onChange={onChange} />
        </div>
        <div
          className={cn(
            'prose dark:prose-invert h-80 max-w-none min-w-0 overflow-auto rounded-lg border p-4',
            mobileTab === 'preview' ? 'block' : 'hidden',
            'md:block',
          )}
        >
          <MarkdownPreview content={value} />
        </div>
      </div>
    </div>
  )
}
