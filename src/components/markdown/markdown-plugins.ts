import rehypeShiki from '@shikijs/rehype'
import type { Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { SHIKI_LANGS } from './code-languages'

// Single source for the markdown render pipeline so the server detail view (RenderMarkdown /
// MarkdownAsync) and the live editor preview (MarkdownPreview / MarkdownHooks) highlight identically.
// Preloads only SHIKI_LANGS rather than Shiki's ~200 default grammars (measured ~3.3s boot + ~129MB
// per server process); `lazy` loads off-list fences on demand, `fallbackLanguage` degrades unknowns to text.
//
// No directive (env-neutral) so both a server and a client renderer can import it — but this statically
// imports @shikijs/rehype, so any CLIENT consumer MUST stay behind a lazy `next/dynamic({ ssr:false })`
// boundary (see editor-with-preview.tsx), or Shiki lands in that page's eager bundle.
export const REMARK_PLUGINS: Options['remarkPlugins'] = [remarkGfm]

export const REHYPE_PLUGINS: Options['rehypePlugins'] = [
  [
    rehypeShiki,
    {
      themes: { light: 'github-light', dark: 'github-dark' },
      langs: SHIKI_LANGS,
      lazy: true,
      fallbackLanguage: 'text',
    },
  ],
]
