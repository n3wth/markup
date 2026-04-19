import { describe, it, expect } from 'vitest'
import { buildPdfDocument } from '../lib/pdf-document'

describe('buildPdfDocument', () => {
  it('wraps body HTML in a full HTML document', () => {
    const out = buildPdfDocument('<p>hello</p>')
    expect(out.startsWith('<!doctype html>')).toBe(true)
    expect(out).toContain('<html lang="en">')
    expect(out).toContain('<p>hello</p>')
    expect(out).toContain('</html>')
  })

  it('includes an inline print stylesheet with @page rule', () => {
    const out = buildPdfDocument('<p>x</p>')
    expect(out).toMatch(/<style>[\s\S]*@page[\s\S]*<\/style>/)
    expect(out).toContain('size: Letter')
  })

  it('uses the provided title in <title> and as H1 header', () => {
    const out = buildPdfDocument('<p>body</p>', { title: 'My Plan' })
    expect(out).toContain('<title>My Plan</title>')
    expect(out).toMatch(/<article class="doc">\s*<h1>My Plan<\/h1>/)
  })

  it('defaults to "Document" when no title given', () => {
    const out = buildPdfDocument('<p>x</p>')
    expect(out).toContain('<title>Document</title>')
  })

  it('does not render an H1 header when renderTitle is false', () => {
    const out = buildPdfDocument('<p>body</p>', { title: 'T', renderTitle: false })
    expect(out).toContain('<title>T</title>')
    expect(out).not.toMatch(/<h1>T<\/h1>/)
  })

  it('escapes HTML in the title', () => {
    const out = buildPdfDocument('<p>x</p>', { title: '<script>alert(1)</script>' })
    expect(out).not.toContain('<script>alert(1)</script>')
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('passes body HTML through unchanged (trusted, post-sanitization)', () => {
    const body = '<h2>Heading</h2><p>Para with <strong>bold</strong> and <a href="https://x.com">link</a></p>'
    const out = buildPdfDocument(body)
    expect(out).toContain(body)
  })

  it('emits print-optimized CSS: page-break rules for headings and list items', () => {
    const out = buildPdfDocument('<p>x</p>')
    expect(out).toContain('page-break-after: avoid')
    expect(out).toContain('page-break-inside: avoid')
    expect(out).toContain('orphans: 3')
    expect(out).toContain('widows: 3')
  })
})
