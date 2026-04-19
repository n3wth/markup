/**
 * Wrap a Tiptap HTML fragment in a self-contained printable HTML
 * document. The returned string is fed to a headless browser which
 * runs `page.pdf()` against it — so all styling required for the PDF
 * output must live inline. No external CSS, no network fetches, no
 * JS. Kept as a pure function so it can be unit-tested without
 * spinning up Chromium.
 *
 * Typography targets US Letter at 11pt body with ~1.5 leading,
 * comfortable margins for long-form reading, and sensible page-break
 * behavior (headings stay with their following content, no orphaned
 * list items).
 */

interface Options {
  /** Document title. Rendered as the PDF's <title> and used as the first H1 when `renderTitle` is true. */
  title?: string
  /** If true, render the title as an H1 at the top of the document. Default: true when title is non-empty. */
  renderTitle?: boolean
}

const PRINT_CSS = `
  @page {
    size: Letter;
    margin: 0.75in;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #111111;
    font-family: ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc {
    max-width: 100%;
  }
  h1, h2, h3, h4, h5, h6 {
    font-weight: 600;
    line-height: 1.25;
    margin: 1.2em 0 0.4em;
    page-break-after: avoid;
    break-after: avoid;
  }
  h1 { font-size: 22pt; margin-top: 0; }
  h2 { font-size: 16pt; }
  h3 { font-size: 13pt; }
  h4, h5, h6 { font-size: 11pt; }
  p, ul, ol, blockquote, pre {
    margin: 0 0 0.8em;
    orphans: 3;
    widows: 3;
  }
  ul, ol { padding-left: 1.4em; }
  li { margin: 0.15em 0; page-break-inside: avoid; break-inside: avoid; }
  a { color: #1a56db; text-decoration: underline; }
  strong { font-weight: 600; }
  em { font-style: italic; }
  code {
    font-family: ui-monospace, 'SF Mono', 'Menlo', 'Consolas', monospace;
    font-size: 0.92em;
    background: #f4f4f5;
    padding: 0.1em 0.35em;
    border-radius: 3px;
  }
  pre {
    background: #f4f4f5;
    padding: 0.8em 1em;
    border-radius: 4px;
    overflow-wrap: break-word;
    white-space: pre-wrap;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  pre code { background: transparent; padding: 0; }
  blockquote {
    border-left: 3px solid #d4d4d8;
    padding-left: 0.9em;
    color: #3f3f46;
  }
  hr {
    border: none;
    border-top: 1px solid #e4e4e7;
    margin: 1.4em 0;
  }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d4d4d8; padding: 0.4em 0.6em; text-align: left; }
`.trim()

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Build a full printable HTML document around a Tiptap HTML fragment.
 * Pure — no DOM, no I/O. The resulting string is ready to hand to
 * `page.setContent()` in a headless browser.
 */
export function buildPdfDocument(bodyHtml: string, opts: Options = {}): string {
  const title = (opts.title || '').trim()
  const renderTitle = opts.renderTitle ?? title.length > 0
  const safeTitle = escapeHtml(title || 'Document')
  const header = renderTitle && title ? `<h1>${escapeHtml(title)}</h1>` : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
<article class="doc">
${header}
${bodyHtml}
</article>
</body>
</html>`
}
