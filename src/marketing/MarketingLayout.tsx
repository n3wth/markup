import { lazy, Suspense, type ReactNode } from 'react'
import { MarkupLogo } from '../MarkupLogo'
import { goToLogin } from './utils'
import { navigate } from './router-navigate'

const ColorPanels = lazy(() =>
  import('@paper-design/shaders-react').then(m => ({ default: m.ColorPanels }))
)

type ShaderVariant = 'warm' | 'cool' | 'prism' | 'mono' | 'sunset' | 'none'

const SHADER_PALETTES: Record<Exclude<ShaderVariant, 'none'>, string[]> = {
  warm: ['#FF9D00', '#FD4F30', '#809BFF', '#6D2EFF', '#333AFF', '#F15CFF', '#FFD557'],
  cool: ['#64d2ff', '#5e5ce6', '#30d158', '#809BFF', '#bf5af2', '#0a84ff'],
  prism: ['#ff6961', '#ffd60a', '#30d158', '#64d2ff', '#bf5af2'],
  mono: ['#ececee', '#787878', '#525252', '#a3a3a3', '#2a2a2a'],
  sunset: ['#ff9d00', '#ff6961', '#f15cff', '#6d2eff', '#333aff'],
}

type NavLink = { href: string; label: string }

const DEFAULT_NAV: NavLink[] = [
  { href: '/features', label: 'Features' },
  { href: '/use-cases', label: 'Use cases' },
  { href: '/agents', label: 'Agents' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
]

type Props = {
  children: ReactNode
  /** Class appended to the page wrapper so each page can layer distinct styling */
  pageClass: string
  /** Named shader palette or 'none' to disable */
  shader?: ShaderVariant
  /** Current pathname — used to mark active nav link */
  activePath?: string
  /** Override shader intensity (0–1). Defaults to 0.45 */
  shaderOpacity?: number
}

export function MarketingLayout({
  children,
  pageClass,
  shader = 'warm',
  activePath,
  shaderOpacity = 0.45,
}: Props) {
  const current = activePath ?? (typeof window !== 'undefined' ? window.location.pathname : '/')

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault()
    navigate(href)
  }

  return (
    <div className={`marketing-page ${pageClass}`}>
      {shader !== 'none' && (
        <div className="marketing-shader" aria-hidden="true">
          <Suspense fallback={null}>
            <ColorPanels
              speed={0.35}
              scale={1.4}
              density={2}
              angle1={0}
              angle2={0}
              length={1.2}
              edges={false}
              blur={0}
              fadeIn={1}
              fadeOut={0.5}
              gradient={0}
              rotation={0}
              offsetX={0}
              offsetY={0}
              maxPixelCount={1920 * 1080}
              minPixelRatio={1}
              colors={SHADER_PALETTES[shader]}
              colorBack="#00000000"
              style={{
                height: '100%',
                width: '100%',
                mixBlendMode: 'screen',
                opacity: shaderOpacity,
              }}
            />
          </Suspense>
        </div>
      )}

      <nav className="marketing-nav" aria-label="Primary">
        <a href="/" className="marketing-nav-logo" aria-label="Markup home" onClick={e => handleNavClick(e, '/')}>
          <MarkupLogo height={20} />
        </a>
        <div className="marketing-nav-links">
          {DEFAULT_NAV.map(link => (
            <a
              key={link.href}
              href={link.href}
              className={`marketing-nav-link ${current === link.href ? 'is-active' : ''}`}
              onClick={e => handleNavClick(e, link.href)}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="marketing-nav-actions">
          <button
            type="button"
            className="marketing-nav-link marketing-nav-signin"
            onClick={() => goToLogin('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            className="marketing-cta-primary marketing-nav-cta"
            onClick={() => goToLogin('signup')}
          >
            Get started
          </button>
        </div>
      </nav>

      <main className="marketing-main">{children}</main>

      <footer className="marketing-footer">
        <div className="marketing-footer-inner">
          <a href="/" className="marketing-footer-logo" aria-label="Markup home" onClick={e => handleNavClick(e, '/')}>
            <MarkupLogo height={18} />
          </a>
          <nav className="marketing-footer-columns" aria-label="Footer">
            <div className="marketing-footer-col">
              <span className="marketing-footer-heading">Product</span>
              <a href="/features" className="marketing-footer-link" onClick={e => handleNavClick(e, '/features')}>Features</a>
              <a href="/use-cases" className="marketing-footer-link" onClick={e => handleNavClick(e, '/use-cases')}>Use cases</a>
              <a href="/agents" className="marketing-footer-link" onClick={e => handleNavClick(e, '/agents')}>Agents</a>
              <a href="/pricing" className="marketing-footer-link" onClick={e => handleNavClick(e, '/pricing')}>Pricing</a>
            </div>
            <div className="marketing-footer-col">
              <span className="marketing-footer-heading">Company</span>
              <a href="/about" className="marketing-footer-link" onClick={e => handleNavClick(e, '/about')}>About</a>
              <a href="/changelog" className="marketing-footer-link" onClick={e => handleNavClick(e, '/changelog')}>Changelog</a>
            </div>
            <div className="marketing-footer-col">
              <span className="marketing-footer-heading">Legal</span>
              <a href="/privacy" className="marketing-footer-link" onClick={e => handleNavClick(e, '/privacy')}>Privacy</a>
              <a href="/terms" className="marketing-footer-link" onClick={e => handleNavClick(e, '/terms')}>Terms</a>
            </div>
          </nav>
          <span className="marketing-footer-credit">
            A project by{' '}
            <a
              href="https://n3wth.com"
              className="marketing-footer-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              n3wth
            </a>
          </span>
        </div>
      </footer>
    </div>
  )
}
