'use client'

import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'

// `lineWrapping` keeps long lines in-column (no horizontal scroll → no grid-column blowout).
// Module-level so the extension array is built once, not per render.
// NB: the editor surface is repointed to --background by a global `.cm-editor` rule in globals.css,
// not here — oneDark's hardcoded #282c34 wins the theme-precedence fight, so CSS is the reliable lever.
//
// The min-height lives on `.cm-content` (the contenteditable), not just the outer box: CodeMirror's
// editable region only grows to fit the text, so a short note left the rest of the editor inert —
// clicks below the text wouldn't focus or place a cursor. Filling `.cm-content` makes the whole
// surface clickable (a click in the empty area lands the cursor on the last line).
const fillHeightTheme = EditorView.theme({
  '&': { minHeight: '20rem' },
  '.cm-content': { minHeight: '20rem' },
})

const extensions = [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  EditorView.lineWrapping,
  fillHeightTheme,
]

type CodeMirrorEditorPropsT = {
  value: string
  onChange: (value: string) => void
}

// `theme="dark"` is required: the default light theme renders white-on-white against the dark shell.
// Default export so the `ssr: false` next/dynamic import in markdown-editor.tsx can load it directly.
export default function CodeMirrorEditor({ value, onChange }: CodeMirrorEditorPropsT) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme="dark"
      extensions={extensions}
      basicSetup={{ lineNumbers: false, foldGutter: false }}
    />
  )
}
