/**
 * Client-side helper that calls the /api/export-pdf serverless function
 * and triggers a browser download of the returned PDF. Keeps the
 * network shape in one place so the command palette, share flow, and
 * any upcoming export modal (W1-T025) can share it.
 */

interface ExportPdfOptions {
  /** Filename without the `.pdf` extension. Defaults to "document". */
  title?: string
  /** Tiptap HTML body. */
  html: string
}

export async function exportPdf(opts: ExportPdfOptions): Promise<void> {
  const { title = 'document', html } = opts
  if (!html) throw new Error('exportPdf: html is required')

  const res = await fetch('/api/export-pdf', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ html, title }),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json() as { error?: string; detail?: string }
      detail = body.error || body.detail || ''
    } catch { /* non-JSON error body */ }
    throw new Error(detail || `Export failed with status ${res.status}`)
  }

  const blob = await res.blob()
  const safeName = (title || 'document').trim().slice(0, 80).replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '-') || 'document'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
