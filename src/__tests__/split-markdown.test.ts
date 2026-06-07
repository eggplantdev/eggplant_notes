import { describe, expect, it } from 'vitest'

import { splitMarkdown } from '@/features/import/utils/split-markdown'

describe('splitMarkdown', () => {
  it('splits on the chosen heading level and uses the heading as the title (excluded from content)', () => {
    const md = ['# One', 'body one', '# Two', 'body two'].join('\n')
    expect(splitMarkdown(md, 1)).toEqual([
      { title: 'One', content: 'body one' },
      { title: 'Two', content: 'body two' },
    ])
  })

  it('matches exactly the requested level — a deeper heading stays in content', () => {
    const md = ['## Section', 'intro', '### Sub', 'detail'].join('\n')
    expect(splitMarkdown(md, 2)).toEqual([{ title: 'Section', content: 'intro\n### Sub\ndetail' }])
  })

  it('does not split on a shallower heading than requested', () => {
    const md = ['# Title', '## A', 'a body', '## B', 'b body'].join('\n')
    // Level 2: the `#` title becomes leading untitled content, then two `##` sections.
    expect(splitMarkdown(md, 2)).toEqual([
      { title: 'Untitled', content: '# Title' },
      { title: 'A', content: 'a body' },
      { title: 'B', content: 'b body' },
    ])
  })

  it('ignores headings inside fenced code blocks', () => {
    const md = ['# Real', 'text', '```py', '# not a heading', '```', 'after'].join('\n')
    expect(splitMarkdown(md, 1)).toEqual([
      { title: 'Real', content: 'text\n```py\n# not a heading\n```\nafter' },
    ])
  })

  it('keeps non-empty pre-heading content as a leading Untitled section', () => {
    const md = ['preamble line', '# First', 'body'].join('\n')
    expect(splitMarkdown(md, 1)).toEqual([
      { title: 'Untitled', content: 'preamble line' },
      { title: 'First', content: 'body' },
    ])
  })

  it('drops a whitespace-only preamble', () => {
    const md = ['', '   ', '# First', 'body'].join('\n')
    expect(splitMarkdown(md, 1)).toEqual([{ title: 'First', content: 'body' }])
  })

  it('returns one Untitled section when there is no heading at the chosen level (degenerate case)', () => {
    const md = ['just', 'some', 'prose'].join('\n')
    expect(splitMarkdown(md, 2)).toEqual([{ title: 'Untitled', content: 'just\nsome\nprose' }])
  })

  it('keeps a title-only section (heading with empty body)', () => {
    const md = ['# Empty', '', '# Has body', 'x'].join('\n')
    expect(splitMarkdown(md, 1)).toEqual([
      { title: 'Empty', content: '' },
      { title: 'Has body', content: 'x' },
    ])
  })

  it('returns nothing for empty input', () => {
    expect(splitMarkdown('', 1)).toEqual([])
  })
})
