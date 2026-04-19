import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { useAuth } from '../lib/auth-context'

export function UpdatePasswordModal({ onClose }: { onClose: () => void }) {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) setError(error)
    else setDone(true)
  }

  return (
    <div className="update-password-backdrop" onClick={handleBackdropClick}>
      <div
        className="update-password-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Update password"
      >
        <h2 className="update-password-title">Set a new password</h2>
        {done ? (
          <>
            <p className="update-password-desc">Password updated. You&apos;re signed in.</p>
            <button type="button" className="home-cta-primary" onClick={onClose}>Continue</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="login-field">
              <span className="login-field-label">New password</span>
              <input
                type="password"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                autoFocus
              />
            </label>
            <label className="login-field">
              <span className="login-field-label">Confirm password</span>
              <input
                type="password"
                className="login-input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </label>
            {error && <div className="login-error" role="alert">{error}</div>}
            <div className="update-password-actions">
              <button type="button" className="login-link" onClick={onClose}>Cancel</button>
              <button type="submit" className="home-cta-primary" disabled={busy}>
                {busy ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
