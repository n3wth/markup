import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createShareByEmail,
  createShareLink,
  listShares,
  revokeShare,
} from '../lib/session-store'
import type { SessionShare, ShareRole } from '../types'
import { useToast } from '../lib/toast-context'

interface Props {
  sessionId: string
  sessionTitle: string
  onClose: () => void
  onLinkCopied?: () => void
}

const ROLE_LABEL: Record<ShareRole, string> = {
  viewer: 'Can view',
  commenter: 'Can comment',
  editor: 'Can edit',
}

function buildShareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`
}

export function ShareModal({ sessionId, sessionTitle, onClose, onLinkCopied }: Props) {
  const { toast } = useToast()
  const overlayRef = useRef<HTMLDivElement>(null)
  const [shares, setShares] = useState<SessionShare[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [linkRole, setLinkRole] = useState<ShareRole>('viewer')
  const [emailInput, setEmailInput] = useState('')
  const [emailRole, setEmailRole] = useState<ShareRole>('editor')

  const refresh = useCallback(async () => {
    try {
      const rows = await listShares(sessionId)
      setShares(rows)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load shares')
      setShares([])
    }
  }, [sessionId])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const tokenShares = (shares ?? []).filter(s => s.principal_type === 'token')
  const emailShares = (shares ?? []).filter(s => s.principal_type === 'email')
  const activeLink = tokenShares.find(s => s.role === linkRole) ?? null

  const handleCreateLink = async () => {
    setCreating(true)
    try {
      const share = await createShareLink(sessionId, linkRole)
      setShares(prev => (prev ? [...prev, share] : [share]))
      const url = buildShareUrl(share.principal)
      try {
        await navigator.clipboard.writeText(url)
        toast({ type: 'success', message: 'Link copied' })
        onLinkCopied?.()
      } catch {
        toast({ type: 'info', message: 'Link created — copy it below' })
      }
    } catch (err) {
      toast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create link',
      })
    } finally {
      setCreating(false)
    }
  }

  const handleCopyLink = async (token: string) => {
    const url = buildShareUrl(token)
    try {
      await navigator.clipboard.writeText(url)
      toast({ type: 'success', message: 'Link copied' })
      onLinkCopied?.()
    } catch {
      toast({ type: 'error', message: 'Failed to copy link' })
    }
  }

  const handleInviteEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = emailInput.trim()
    if (!email || !email.includes('@')) {
      toast({ type: 'error', message: 'Enter a valid email address' })
      return
    }
    try {
      const share = await createShareByEmail(sessionId, email, emailRole)
      setShares(prev => (prev ? [...prev, share] : [share]))
      setEmailInput('')
      toast({ type: 'success', message: `Invited ${share.principal}` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to invite'
      // A duplicate email grant hits the unique index; surface a friendlier error.
      if (msg.toLowerCase().includes('duplicate')) {
        toast({ type: 'info', message: `${email} already has access` })
      } else {
        toast({ type: 'error', message: msg })
      }
    }
  }

  const handleRevoke = async (share: SessionShare) => {
    // Optimistic removal — re-add on error so the UI stays truthful.
    setShares(prev => (prev ? prev.filter(s => s.id !== share.id) : prev))
    try {
      await revokeShare(share.id)
      toast({ type: 'success', message: 'Access revoked' })
    } catch (err) {
      setShares(prev => (prev ? [...prev, share] : [share]))
      toast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to revoke',
      })
    }
  }

  return (
    <div
      className="share-modal-overlay"
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <div className="share-modal-header">
          <h2 className="share-modal-title" id="share-title">Share “{sessionTitle}”</h2>
          <button type="button" className="share-modal-close" onClick={onClose} aria-label="Close">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <section className="share-modal-section">
          <h3 className="share-modal-subtitle">Anyone with the link</h3>
          <div className="share-modal-link-row">
            <select
              className="share-modal-select"
              value={linkRole}
              onChange={(e) => setLinkRole(e.target.value as ShareRole)}
              aria-label="Link permission"
            >
              <option value="viewer">Can view</option>
              <option value="commenter">Can comment</option>
              <option value="editor">Can edit</option>
            </select>
            {activeLink ? (
              <>
                <input
                  className="share-modal-link-input"
                  readOnly
                  value={buildShareUrl(activeLink.principal)}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="share-modal-btn"
                  onClick={() => handleCopyLink(activeLink.principal)}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="share-modal-btn share-modal-btn-danger"
                  onClick={() => handleRevoke(activeLink)}
                >
                  Revoke
                </button>
              </>
            ) : (
              <button
                type="button"
                className="share-modal-btn share-modal-btn-primary"
                onClick={handleCreateLink}
                disabled={creating}
              >
                {creating ? 'Creating…' : 'Create link'}
              </button>
            )}
          </div>
          {linkRole !== 'viewer' && (
            <p className="share-modal-hint">
              Recipients must sign in to {linkRole === 'commenter' ? 'comment' : 'edit'}.
            </p>
          )}
        </section>

        <section className="share-modal-section">
          <h3 className="share-modal-subtitle">Invite by email</h3>
          <form className="share-modal-invite-row" onSubmit={handleInviteEmail}>
            <input
              type="email"
              className="share-modal-email-input"
              placeholder="person@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              aria-label="Recipient email"
            />
            <select
              className="share-modal-select"
              value={emailRole}
              onChange={(e) => setEmailRole(e.target.value as ShareRole)}
              aria-label="Email permission"
            >
              <option value="viewer">Can view</option>
              <option value="commenter">Can comment</option>
              <option value="editor">Can edit</option>
            </select>
            <button type="submit" className="share-modal-btn share-modal-btn-primary">
              Invite
            </button>
          </form>
        </section>

        <section className="share-modal-section">
          <h3 className="share-modal-subtitle">People with access</h3>
          {loadError && <div className="share-modal-error" role="alert">{loadError}</div>}
          {shares === null && !loadError && (
            <div className="share-modal-empty">Loading…</div>
          )}
          {shares && emailShares.length === 0 && tokenShares.length === 0 && (
            <div className="share-modal-empty">No one else has access yet.</div>
          )}
          {emailShares.length > 0 && (
            <ul className="share-modal-list">
              {emailShares.map(s => (
                <li key={s.id} className="share-modal-list-row">
                  <div className="share-modal-list-principal">{s.principal}</div>
                  <div className="share-modal-list-role">{ROLE_LABEL[s.role]}</div>
                  <button
                    type="button"
                    className="share-modal-btn share-modal-btn-small"
                    onClick={() => handleRevoke(s)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
