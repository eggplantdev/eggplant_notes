'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// Two read sources that both produce raw markdown text: a file picker (read client-side via the File
// API — no storage bucket) and a paste textarea. PDF/image/audio are deliberately out of scope here
// (future, AI read stage); this stays plain text.
export function SourceInput({
  value,
  onChange,
}: {
  value: string
  onChange: (text: string) => void
}) {
  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    onChange(await file.text())
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2">
        <Label htmlFor="import-file">Upload a markdown file</Label>
        <input
          id="import-file"
          data-testid="import-file"
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          onChange={handleFile}
          className="file:text-foreground text-muted-foreground w-fit text-sm file:mr-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-1.5 file:text-sm"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="import-paste">…or paste markdown</Label>
        <Textarea
          id="import-paste"
          data-testid="import-paste"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="# Heading&#10;Notes go here…"
          className="min-h-40 font-mono"
        />
      </div>
    </div>
  )
}
