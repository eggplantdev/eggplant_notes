'use client'

import { AccordionArrow } from '@/components/ui/accordion-arrow'
import { Label } from '@/components/ui/label'
import { MutedText } from '@/components/ui/muted-text'
import { Textarea } from '@/components/ui/textarea'
import type { PdfSourceT } from '@/features/import/types'
import { isPdfFile, readFileAsBase64 } from '@/features/import/utils/read-file-base64'

// Three read sources feeding the import pipeline: a markdown/txt file (read client-side as text via
// the File API — no storage bucket), a paste textarea, and a PDF (read as base64 and handed to a
// vision model, Phase 8). Markdown/paste produce text the deterministic splitter can use; a PDF has
// no text here, so it routes only through AI decompose.
export function SourceInput({
  value,
  onChange,
  onPdf,
  pdfName,
  isPasteOpen,
  onTogglePaste,
}: {
  value: string
  onChange: (text: string) => void
  // Called when a PDF is chosen (the only AI-vision source). The parent clears it when text is typed.
  onPdf?: (pdf: PdfSourceT) => void
  // Name of the currently-selected PDF, shown as confirmation; undefined when the source is text.
  pdfName?: string
  // Fold state is owned by the parent so the split-level controls collapse in lockstep with the paste box.
  isPasteOpen: boolean
  onTogglePaste: () => void
}) {
  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (onPdf && isPdfFile(file)) {
      onPdf({ dataBase64: await readFileAsBase64(file), filename: file.name })
      return
    }
    onChange(await file.text())
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2">
        <Label htmlFor="import-file">Upload a file</Label>
        <input
          id="import-file"
          data-testid="import-file"
          type="file"
          accept={
            onPdf
              ? '.md,.markdown,.txt,.pdf,text/markdown,text/plain,application/pdf'
              : '.md,.markdown,.txt,text/markdown,text/plain'
          }
          onChange={handleFile}
          className="file:text-foreground text-muted-foreground w-fit text-[0.8rem] file:mr-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-1.5 file:text-[0.8rem]"
        />
        <MutedText>
          {onPdf ? 'Markdown, plain text, or PDF.' : 'Markdown or plain text.'}
          {pdfName ? ` Selected: ${pdfName}` : ''}
        </MutedText>
      </div>
      <div className="grid gap-2">
        <button
          type="button"
          onClick={onTogglePaste}
          aria-expanded={isPasteOpen}
          aria-controls="import-paste"
          className="group flex w-full cursor-pointer items-center justify-between gap-1.5 pb-2"
        >
          <Label htmlFor="import-paste" className="pointer-events-none">
            …or paste markdown
          </Label>
          <AccordionArrow
            isOpen={isPasteOpen}
            className="group-hover:text-neon-cyan group-hover:drop-shadow-neon-cyan duration-300"
          />
        </button>
        {isPasteOpen && (
          <Textarea
            id="import-paste"
            data-testid="import-paste"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="# Heading&#10;Notes go here…"
            className="min-h-40 font-mono"
          />
        )}
      </div>
    </div>
  )
}
