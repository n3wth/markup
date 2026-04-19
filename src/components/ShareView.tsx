import { useEffect, useState } from 'react'
import { logShareEvent, resolveShareLink, type ResolvedShareLink } from '../lib/session-store'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'denied' }
  | { kind: 'ok'; payload: ResolvedShareLink }

interface Props {
  token: string
}

/**
 * Public landing for a share link. Resolves the token server-side
 * (SECURITY DEFINER RPC — see migration 012), logs an open event, and
 * renders the document read-only. No editor, no agents, no chat.
 *
 * Commenter / editor upgrades land with W1-T012 / W1-T013; this view
 * currently treats every role as read-only, which is the safe fallback
 * until the write paths are wired.
 */
export function ShareView({ token }: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    resolveShareLink(token).then(payload => {
      if (cancelled) return
      if (!payload) {
        setState({ kind: 'denied' })
        return
      }
      setState({ kind: 'ok', payload })
      // Fire-and-forget: analytics failure must not block the viewer.
      void logShareEvent(payload.shareId)
    })
    return () => { cancelled = true }
  }, [token])

  if (state.kind === 'loading') {
    return (
      <div className="share-view-shell">
        <div className="share-view-empty">Loading…</div>
      </div>
    )
  }

  if (state.kind === 'denied') {
    return (
      <div className="share-view-shell">
        <div className="share-view-empty">
          <h1 className="share-view-title">Link unavailable</h1>
          <p className="share-view-desc">
            This share link is invalid, has been revoked, or has expired.
          </p>
          <a className="share-view-home" href="/">Go to markup</a>
        </div>
      </div>
    )
  }

  const { payload } = state

  return (
    <div className="share-view-shell">
      <header className="share-view-header">
        <div className="share-view-title-row">
          <span className="share-view-doc-title">{payload.sessionTitle}</span>
          <span className="share-view-badge">Shared · {payload.role}</span>
        </div>
        <a className="share-view-home" href="/">Open markup</a>
      </header>
      <main className="share-view-body">
        <article
          className="share-view-doc"
          // Content comes from the author's saved HTML snapshot. The editor
          // sanitises output on save, so we're rendering the author's own
          // trusted markup into their own doc view — same content that
          // would appear in the full editor for an authenticated viewer.
          dangerouslySetInnerHTML={{ __html: payload.documentHtml ?? '' }}
        />
      </main>
    </div>
  )
}
