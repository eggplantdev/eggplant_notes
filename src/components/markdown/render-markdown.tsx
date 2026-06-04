import rehypeShiki from '@shikijs/rehype'
import { MarkdownAsync } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { SHIKI_LANGS } from './code-languages'

type RenderMarkdownPropsT = { content: string }

// Async Server Component: renders a markdown string with GFM + Shiki dual-theme code
// highlighting. Shiki is async, so this uses react-markdown's `MarkdownAsync` (not the
// default sync `Markdown`, which runs processSync and can't await @shikijs/rehype). Runs
// server-side only — zero highlighting bytes reach the client. Must NOT be imported into
// a client component. react-markdown escapes raw HTML by default (no rehype-raw), so note
// bodies can't inject executable markup.
//
// Langs: preload only the curated SHIKI_LANGS (the picker's set) instead of letting
// @shikijs/rehype default to all ~200 bundled grammars — that default costs a measured
// ~3.3s boot + ~129MB on the first render per server process. `lazy: true` loads any
// off-list-but-valid fence on demand; `fallbackLanguage: 'text'` degrades an unknown fence
// to plain text instead of throwing on a render path.
export async function RenderMarkdown({ content }: RenderMarkdownPropsT) {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <MarkdownAsync
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [
            rehypeShiki,
            {
              themes: { light: 'github-light', dark: 'github-dark' },
              langs: SHIKI_LANGS,
              lazy: true,
              fallbackLanguage: 'text',
            },
          ],
        ]}
      >
        {content}
      </MarkdownAsync>
    </div>
  )
}
