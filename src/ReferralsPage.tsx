import { useEffect, useState } from 'react'
import { buildReferralLink, listMyReferrals, loadMyProfile, type Profile, type Referral } from './lib/referrals'

interface Props {
  onClose: () => void
}

export function ReferralsPage({ onClose }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([loadMyProfile(), listMyReferrals()]).then(([p, r]) => {
      if (!alive) return
      setProfile(p)
      setReferrals(r)
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  const link = profile ? buildReferralLink(profile.referral_code) : ''

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can fail in insecure contexts; fall back to selecting the input.
      const el = document.getElementById('referral-link-input') as HTMLInputElement | null
      el?.select()
    }
  }

  return (
    <div className="referrals-page">
      <div className="referrals-shell">
        <header className="referrals-header">
          <h1>Invite friends</h1>
          <button type="button" className="referrals-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {loading ? (
          <div className="referrals-loading">Loading…</div>
        ) : !profile ? (
          <div className="referrals-empty">Sign in to get your referral code.</div>
        ) : (
          <>
            <section className="referrals-code-section">
              <div className="referrals-code-label">Your code</div>
              <div className="referrals-code">{profile.referral_code}</div>
              <div className="referrals-link-row">
                <input
                  id="referral-link-input"
                  className="referrals-link-input"
                  type="text"
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="referrals-copy-btn"
                  onClick={copy}
                  data-copied={copied ? 'true' : 'false'}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="referrals-help">
                Share this link. Anyone who signs up through it is attributed to you.
              </p>
            </section>

            <section className="referrals-list-section">
              <div className="referrals-list-header">
                <span className="referrals-list-title">Referrals</span>
                <span className="referrals-list-count">{referrals.length}</span>
              </div>
              {referrals.length === 0 ? (
                <div className="referrals-empty">No referrals yet.</div>
              ) : (
                <ul className="referrals-list">
                  {referrals.map((r) => (
                    <li key={r.id} className="referrals-row">
                      <span className="referrals-row-ref">{r.referee_id.slice(0, 8)}…</span>
                      <span className="referrals-row-status" data-status={r.status}>{r.status}</span>
                      <span className="referrals-row-date">{formatDate(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
