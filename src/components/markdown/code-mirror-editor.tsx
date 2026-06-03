'use client'

import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'

// `markdown({ base, codeLanguages })` gives free nested code-fence highlighting:
// @codemirror/language-data lazily imports each grammar on demand. `lineWrapping` keeps
// long lines inside the column (no horizontal scroll → no grid-column blowout when
// typing). Module-level so the extension array is built once.
const extensions = [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  EditorView.lineWrapping,
]

type CodeMirrorEditorPropsT = {
  value: string
  onChange: (value: string) => void
}

// The actual CodeMirror surface. This whole module is loaded ONLY via the `ssr: false`
// dynamic import in markdown-editor.tsx, so none of the CodeMirror/codemirror-view code ever
// runs on the server. `theme="dark"` matches the app's (currently always-on) dark shell —
// the default light theme rendered white-on-white. Default export so `next/dynamic` can
// import it directly.
export default function CodeMirrorEditor({ value, onChange }: CodeMirrorEditorPropsT) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme="dark"
      height="20rem"
      extensions={extensions}
      basicSetup={{ lineNumbers: false, foldGutter: false }}
    />
  )
}
