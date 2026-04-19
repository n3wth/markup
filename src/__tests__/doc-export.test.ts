import { describe, it, expect } from 'vitest'
import { htmlToMarkdown } from '../lib/doc-export'

describe('htmlToMarkdown', () => {
  it('renders headings', () => {
    expect(htmlToMarkdown('<h1>Hello</h1>')).toBe('# Hello\n')
    expect(htmlToMarkdown('<h2>Sub</h2>')).toBe('## Sub\n')
  })

  it('renders paragraphs', () => {
    expect(htmlToMarkdown('<p>one</p><p>two</p>')).toBe('one\n\ntwo\n')
  })

  it('renders inline formatting', () => {
    expect(htmlToMarkdown('<p>a <strong>b</strong> <em>c</em> <code>d</code></p>'))
      .toBe('a **b** _c_ `d`\n')
  })

  it('renders links', () => {
    expect(htmlToMarkdown('<p>see <a href="https://x.com">x</a></p>'))
      .toBe('see [x](https://x.com)\n')
  })

  it('renders unordered lists', () => {
    expect(htmlToMarkdown('<ul><li>one</li><li>two</li></ul>'))
      .toBe('- one\n- two\n')
  })

  it('renders ordered lists', () => {
    expect(htmlToMarkdown('<ol><li>a</li><li>b</li></ol>'))
      .toBe('1. a\n2. b\n')
  })

  it('renders code blocks with language hint', () => {
    const out = htmlToMarkdown('<pre><code class="language-ts">const x = 1</code></pre>')
    expect(out).toBe('```ts\nconst x = 1\n```\n')
  })

  it('renders blockquotes', () => {
    expect(htmlToMarkdown('<blockquote><p>quoted</p></blockquote>'))
      .toBe('> quoted\n')
  })

  it('renders horizontal rule', () => {
    expect(htmlToMarkdown('<hr/>')).toBe('---\n')
  })

  it('decodes html entities', () => {
    expect(htmlToMarkdown('<p>Tom &amp; Jerry &lt;3</p>')).toBe('Tom & Jerry <3\n')
  })

  it('prepends title when provided', () => {
    expect(htmlToMarkdown('<p>body</p>', { title: 'Hello' }))
      .toBe('# Hello\n\nbody\n')
  })

  it('gracefully handles unknown tags', () => {
    expect(htmlToMarkdown('<p>a <span>b</span> c</p>')).toBe('a b c\n')
  })
})
