import { lazy, Suspense, useState, type FormEvent } from 'react'
const ColorPanels = lazy(() => import('@paper-design/shaders-react').then(m => ({ default: m.ColorPanels })))
import { MarkupLogo } from './MarkupLogo'
import { useAuth } from './lib/auth-context'

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Unknown error'
}

type Mode = 'signin' | 'signup' | 'reset'

export function LoginPage() {
  const {
    signInWithGoogle,
    signInWithGitHub,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
  } = useAuth()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const resetStatus = () => {
    setError(null)
    setNotice(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    resetStatus()
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await signInWithEmail(email.trim(), password)
        if (error) setError(error)
      } else if (mode === 'signup') {
        const { error } = await signUpWithEmail(email.trim(), password, displayName.trim() || undefined)
        if (error) setError(error)
        else setNotice('Check your email to verify your account.')
      } else {
        const { error } = await resetPassword(email.trim())
        if (error) setError(error)
        else setNotice('Password reset link sent. Check your email.')
      }
    } catch (err) {
      setError(formatError(err))
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (next: Mode) => {
    resetStatus()
    setMode(next)
  }

  const title = mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in'
  const submitLabel = mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'

  return (
    <div className="login-page">
      <div className="login-shader">
        <img src="/hero-bg.jpg" alt="" decoding="async" fetchPriority="high" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7, zIndex: 0 }} />
        <Suspense fallback={null}>
          <ColorPanels speed={0.5} scale={1.15} density={3} angle1={0} angle2={0} length={1.1} edges={false} blur={0} fadeIn={1} fadeOut={0.3} gradient={0} rotation={0} offsetX={0} offsetY={0} maxPixelCount={1920 * 1080} minPixelRatio={1} colors={['#FF9D00', '#FD4F30', '#809BFF', '#6D2EFF', '#333AFF', '#F15CFF', '#FFD557']} colorBack="#00000000" style={{ height: '100%', width: '100%', mixBlendMode: 'screen' }} />
        </Suspense>
      </div>
      <div className="login-content">
        <nav className="login-nav">
          <div className="home-nav-logo">
            <MarkupLogo height={20} className="home-nav-logo-img" />
          </div>
          <div className="home-nav-actions">
            <button type="button" className="login-google-btn login-google-btn--nav" onClick={signInWithGoogle}>
              Sign in with Google
            </button>
          </div>
        </nav>

        <header className="login-hero">
          <h1 className="login-headline">
            <span className="login-headline-main">Write with</span>
            <span className="login-headline-main">AI experts.</span>
          </h1>
          <p className="login-subtitle">
            AI agents that read your docs and push back on what you missed.
          </p>

          <form className="login-form" onSubmit={handleSubmit} aria-label={title}>
            <h2 className="login-form-title">{title}</h2>

            {mode === 'signup' && (
              <label className="login-field">
                <span className="login-field-label">Display name</span>
                <input
                  type="text"
                  className="login-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  placeholder="Your name"
                />
              </label>
            )}

            <label className="login-field">
              <span className="login-field-label">Email</span>
              <input
                type="email"
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>

            {mode !== 'reset' && (
              <label className="login-field">
                <span className="login-field-label">Password</span>
                <input
                  type="password"
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={8}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                />
              </label>
            )}

            {error && <div className="login-error" role="alert">{error}</div>}
            {notice && <div className="login-notice" role="status">{notice}</div>}

            <button type="submit" className="home-cta-primary login-submit" disabled={busy}>
              {busy ? 'Working…' : submitLabel}
            </button>

            <div className="login-links">
              {mode === 'signin' && (
                <>
                  <button type="button" className="login-link" onClick={() => switchMode('reset')}>
                    Forgot password?
                  </button>
                  <button type="button" className="login-link" onClick={() => switchMode('signup')}>
                    Create account
                  </button>
                </>
              )}
              {mode === 'signup' && (
                <button type="button" className="login-link" onClick={() => switchMode('signin')}>
                  Have an account? Sign in
                </button>
              )}
              {mode === 'reset' && (
                <button type="button" className="login-link" onClick={() => switchMode('signin')}>
                  Back to sign in
                </button>
              )}
            </div>

            <div className="login-divider"><span>or</span></div>

            <div className="login-oauth-row">
              <button type="button" className="login-google-btn" onClick={signInWithGoogle}>
                Continue with Google
              </button>
              <button type="button" className="login-google-btn" onClick={signInWithGitHub}>
                Continue with GitHub
              </button>
            </div>
          </form>
        </header>

        <footer className="login-footer">
          <div className="login-footer-left">
            <a href="/privacy" className="login-footer-link">Privacy</a>
            <a href="/terms" className="login-footer-link">Terms</a>
          </div>
          <div className="login-footer-right">
            <span className="login-footer-credit">A project by <a href="https://n3wth.com" className="login-footer-link" target="_blank" rel="noopener noreferrer">n3wth</a></span>
          </div>
        </footer>
      </div>
    </div>
  )
}
