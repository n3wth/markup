import type { VercelRequest, VercelResponse } from '@vercel/node'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

// Note: the HTML-wrapping logic below is duplicated from
// src/lib/pdf-document.ts on purpose. Vercel compiles api/ and src/
// on separate boundaries, and the other api/ handlers in this repo
// never reach across. Keeping this file self-contained avoids a
// fragile cross-dir import. If the CSS or structure changes, update
// both files together — the unit test in pdf-document.test.ts covers
// the shared contract.

const PRINT_CSS = `
  @page { size: Letter; margin: 0.75in; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: #ffffff; color: #111111;
    font-family: ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 11pt; line-height: 1.55;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .doc { max-width: 100%; }
  h1, h2, h3, h4, h5, h6 {
    font-weight: 600; line-height: 1.25; margin: 1.2em 0 0.4em;
    page-break-after: avoid; break-after: avoid;
  }
  h1 { font-size: 22pt; margin-top: 0; }
  h2 { font-size: 16pt; }
  h3 { font-size: 13pt; }
  h4, h5, h6 { font-size: 11pt; }
  p, ul, ol, blockquote, pre { margin: 0 0 0.8em; orphans: 3; widows: 3; }
  ul, ol { padding-left: 1.4em; }
  li { margin: 0.15em 0; page-break-inside: avoid; break-inside: avoid; }
  a { color: #1a56db; text-decoration: underline; }
  strong { font-weight: 600; }
  em { font-style: italic; }
  code {
    font-family: ui-monospace, 'SF Mono', 'Menlo', 'Consolas', monospace;
    font-size: 0.92em; background: #f4f4f5;
    padding: 0.1em 0.35em; border-radius: 3px;
  }
  pre {
    background: #f4f4f5; padding: 0.8em 1em; border-radius: 4px;
    overflow-wrap: break-word; white-space: pre-wrap;
    page-break-inside: avoid; break-inside: avoid;
  }
  pre code { background: transparent; padding: 0; }
  blockquote { border-left: 3px solid #d4d4d8; padding-left: 0.9em; color: #3f3f46; }
  hr { border: none; border-top: 1px solid #e4e4e7; margin: 1.4em 0; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d4d4d8; padding: 0.4em 0.6em; text-align: left; }
`.trim()

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildPdfDocument(bodyHtml: string, title: string): string {
  const safeTitle = escapeHtml(title || 'Document')
  const header = title ? `<h1>${escapeHtml(title)}</h1>` : ''
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

// Serverless budget. Chromium cold start is ~2-4s; rendering long docs
// can push total wall time higher, so we allow up to a minute.
export const maxDuration = 60

// Hard cap on the inbound HTML payload. A normal Markup doc is well
// under 100KB; anything above this is almost certainly abuse or a
// misbehaving client.
const MAX_HTML_BYTES = 2 * 1024 * 1024 // 2MB

function sanitizeFilename(raw: string): string {
  const base = (raw || 'document').trim().slice(0, 80)
  // Strip anything that isn't alphanumeric, space, dash, underscore, dot.
  // Falls back to 'document' if the sanitized version is empty.
  const safe = base.replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '-')
  return safe || 'document'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { html, title } = (req.body || {}) as { html?: unknown; title?: unknown }

  if (typeof html !== 'string' || html.length === 0) {
    return res.status(400).json({ error: 'Missing html in request body', code: 'BAD_REQUEST' })
  }
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
    return res.status(413).json({ error: 'HTML payload too large', code: 'PAYLOAD_TOO_LARGE' })
  }

  const docTitle = typeof title === 'string' ? title : ''
  const fullHtml = buildPdfDocument(html, docTitle)

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' })
    // `preferCSSPageSize: true` makes puppeteer honor the `@page` size
    // declared in our inline print stylesheet rather than its own
    // default. Margins come from the stylesheet too, so we pass empty
    // overrides here.
    const pdf = await page.pdf({
      format: 'letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    })
    await page.close()

    const filename = `${sanitizeFilename(docTitle)}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', pdf.length.toString())
    // Cache-buster: PDF content reflects the exact HTML we received,
    // but the HTML changes on every save, so let the browser treat
    // each response as fresh.
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send(pdf)
  } catch (err) {
    console.error('[export-pdf] Render failed:', err)
    return res.status(500).json({
      error: 'Failed to render PDF',
      code: 'RENDER_ERROR',
      detail: err instanceof Error ? err.message : String(err),
    })
  } finally {
    if (browser) {
      try { await browser.close() } catch { /* best-effort */ }
    }
  }
}
