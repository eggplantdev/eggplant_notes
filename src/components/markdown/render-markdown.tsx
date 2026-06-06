import rehypeShiki from '@shikijs/rehype'
import { MarkdownAsync } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { SHIKI_LANGS } from './code-languages'

type RenderMarkdownPropsT = { content: string }

// Server-only — must NOT be imported into a client component (keeps Shiki bytes off the client).
// Uses `MarkdownAsync` because Shiki is async (sync `Markdown` can't await @shikijs/rehype).
// No rehype-raw, so raw HTML stays escaped and note bodies can't inject executable markup.
// Preloads only SHIKI_LANGS rather than Shiki's ~200 default grammars (measured ~3.3s boot + ~129MB
// per server process); `lazy` loads off-list fences on demand, `fallbackLanguage` degrades unknowns to text.
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
