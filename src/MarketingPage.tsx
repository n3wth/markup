import { Link } from 'react-router-dom'
import { MarketingLayout } from './marketing/MarketingLayout'
import { goToLogin } from './marketing/utils'
import { HeroSection } from './marketing/HeroSection'

const HIGHLIGHTS = [
  {
    eyebrow: 'Features',
    href: '/features',
    title: 'A standing panel, at draft speed',
    body: 'Four specialist voices reading the same doc. Real-time cursors, inline edits, push-back where it matters.',
  },
  {
    eyebrow: 'Use cases',
    href: '/use-cases',
    title: 'Blog posts, docs, social, and more',
    body: 'Any kind of writing improves when someone asks the hard questions early. See how Markup helps across six common types.',
  },
  {
    eyebrow: 'Agents',
    href: '/agents',
    title: 'Meet Aiden, Nova, Lex, Mira',
    body: 'Engineering, product, legal, design. Distinct personas, tuned rhythms, built to disagree.',
  },
]

export function MarketingPage() {
  return (
    <MarketingLayout pageClass="marketing-page-home" shader="warm" activePath="/">
      <HeroSection />

      <section className="marketing-proof" aria-label="Social proof">
        <p className="marketing-proof-label">Built on</p>
        <ul className="marketing-proof-list">
          <li>React 19</li>
          <li>Tiptap 3</li>
          <li>Gemini 2.5 Flash</li>
          <li>Supabase</li>
          <li>Vercel</li>
        </ul>
      </section>

      <section className="marketing-section marketing-highlights" aria-labelledby="highlights-title">
        <header className="marketing-section-header">
          <p className="marketing-eyebrow">Explore</p>
          <h2 id="highlights-title" className="marketing-section-title">
            Three ways in
          </h2>
        </header>
        <ul className="marketing-highlight-grid">
          {HIGHLIGHTS.map(h => (
            <li key={h.href} className="marketing-highlight-card">
              <p className="marketing-eyebrow">{h.eyebrow}</p>
              <h3 className="marketing-highlight-title">{h.title}</h3>
              <p className="marketing-highlight-body">{h.body}</p>
              <Link to={h.href} className="marketing-highlight-link">
                Read more <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="marketing-closing" aria-labelledby="closing-title">
        <h2 id="closing-title" className="marketing-closing-title">
          Ship drafts that survive the room.
        </h2>
        <p className="marketing-closing-sub">
          Free while in early access. No credit card, no onboarding call.
        </p>
        <div className="marketing-cta-row">
          <button
            type="button"
            className="marketing-cta-primary marketing-closing-cta"
            onClick={() => goToLogin('signup')}
          >
            Start writing free
          </button>
          <Link to="/pricing" className="marketing-cta-secondary marketing-closing-cta">
            See pricing
          </Link>
        </div>
      </section>
    </MarketingLayout>
  )
}
