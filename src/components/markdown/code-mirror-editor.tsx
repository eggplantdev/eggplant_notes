'use client'

import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'

// `lineWrapping` keeps long lines in-column (no horizontal scroll → no grid-column blowout).
// Module-level so the extension array is built once, not per render.
// NB: the editor surface is repointed to --background by a global `.cm-editor` rule in globals.css,
// not here — oneDark's hardcoded #282c34 wins the theme-precedence fight, so CSS is the reliable lever.
const extensions = [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  EditorView.lineWrapping,
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
      minHeight="20rem"
      extensions={extensions}
      basicSetup={{ lineNumbers: false, foldGutter: false }}
    />
  )
}
