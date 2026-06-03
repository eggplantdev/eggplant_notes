import rehypeShiki from '@shikijs/rehype'
import { MarkdownAsync } from 'react-markdown'
import remarkGfm from 'remark-gfm'

type RenderMarkdownPropsT = { content: string }

// Async Server Component: renders a markdown string with GFM + Shiki dual-theme code
// highlighting. Shiki is async, so this uses react-markdown's `MarkdownAsync` (not the
// default sync `Markdown`, which runs processSync and can't await @shikijs/rehype). Runs
// server-side only — zero highlighting bytes reach the client. Must NOT be imported into
// a client component. react-markdown escapes raw HTML by default (no rehype-raw), so note
// bodies can't inject executable markup.
export async function RenderMarkdown({ content }: RenderMarkdownPropsT) {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <MarkdownAsync
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeShiki, { themes: { light: 'github-light', dark: 'github-dark' } }]]}
      >
        {content}
      </MarkdownAsync>
    </div>
  )
}
