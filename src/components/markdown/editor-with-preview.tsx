'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

import { CodeBlockInserter } from '@/components/markdown/code-block-inserter'
import { MarkdownEditor } from '@/components/markdown/markdown-editor'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Preview is hidden by default (Write pane), so defer its Shiki bundle until the user toggles to it.
// ssr:false is legal here because this is a client component. `importPreview` is shared by the dynamic
// loader and the hover/focus prefetch below so they hit the same (deduped) chunk — warming it on intent
// means the chunk is usually downloaded before the click, so the loading state seldom shows.
const importPreview = () => import('@/components/markdown/markdown-preview')
const MarkdownPreview = dynamic(() => importPreview().then((m) => m.MarkdownPreview), {
  ssr: false,
  loading: () => <p className="text-muted-foreground">Loading preview…</p>,
})

type PaneT = 'write' | 'preview'

// One full-width pane at a time, toggled — never side by side. The editor stays mounted (toggled via
// `hidden`) so flipping keeps its cursor/undo/scroll; the preview is mounted only while active so its
// lazy Shiki chunk loads on first toggle, not on page load.
export function EditorWithPreview({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [pane, setPane] = useState<PaneT>('write')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {pane === 'write' && <CodeBlockInserter value={value} onChange={onChange} />}
        <div className="ml-auto flex gap-2" role="tablist">
          <Button
            type="button"
            size="sm"
            variant={pane === 'write' ? 'default' : 'outline'}
            onClick={() => setPane('write')}
          >
            Write
          </Button>
          <Button
            type="button"
            size="sm"
            variant={pane === 'preview' ? 'default' : 'outline'}
            onMouseEnter={importPreview}
            onFocus={importPreview}
            onClick={() => setPane('preview')}
          >
            Preview
          </Button>
        </div>
      </div>

      <div className={cn('min-w-0', pane === 'write' ? 'block' : 'hidden')}>
        <MarkdownEditor value={value} onChange={onChange} />
      </div>
      {pane === 'preview' && (
        <div className="prose dark:prose-invert min-h-80 max-w-none min-w-0 rounded-lg border p-4">
          <MarkdownPreview content={value} />
        </div>
      )}
    </div>
  )
}
