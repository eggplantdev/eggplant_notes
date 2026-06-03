'use client'

import dynamic from 'next/dynamic'

// CodeMirror touches `window`/`document`, so it can only load on the client. `ssr: false`
// is legal only inside a `'use client'` component (Next 16). Pointing the dynamic import at
// code-mirror-editor.tsx keeps the entire CodeMirror dep graph (view, lang-markdown,
// language grammars) out of the server bundle and ships it ONLY on /notes/new +
// /notes/[id]/edit — never on the list/detail routes.
const CodeMirrorEditor = dynamic(() => import('@/features/notes/code-mirror-editor'), {
  ssr: false,
  loading: () => <div className="bg-muted h-80 animate-pulse rounded-lg" />,
})

type NoteEditorPropsT = {
  value: string
  onChange: (value: string) => void
}

// Controlled editing surface. Value/onChange come from the form's `content` field — the
// editor is NOT registered into the shared form hook (it's a 3rd-party controlled input).
export function NoteEditor({ value, onChange }: NoteEditorPropsT) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <CodeMirrorEditor value={value} onChange={onChange} />
    </div>
  )
}
