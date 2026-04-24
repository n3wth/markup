import { MarketingLayout } from './marketing/MarketingLayout'
import { goToLogin } from './marketing/utils'

const AGENT_CARDS = [
  {
    name: 'Aiden',
    role: 'Engineering',
    color: '#30d158',
    tagline: 'Pins vague specs to concrete interfaces and failure modes.',
  },
  {
    name: 'Nova',
    role: 'Product',
    color: '#ff6961',
    tagline: 'Asks who benefits, what breaks, and where adoption stalls.',
  },
  {
    name: 'Lex',
    role: 'Legal',
    color: '#64d2ff',
    tagline: 'Flags regulatory risk, privacy gaps, and contractual ambiguity.',
  },
  {
    name: 'Mira',
    role: 'Design',
    color: '#ffd60a',
    tagline: 'Advocates for the user and questions complexity that hurts flow.',
  },
]

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
    title: 'PRDs, specs, RFCs, briefs',
    body: 'The documents that live or die by review. Markup gives you the review loop before the stakeholder one.',
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
      <section className="marketing-hero" aria-labelledby="hero-headline">
        <span className="marketing-pill">Early access · free while it lasts</span>
        <h1 id="hero-headline" className="marketing-headline">
          <span className="marketing-headline-line">Every draft, reviewed by</span>
          <span className="marketing-headline-line marketing-headline-italic">four experts.</span>
        </h1>
        <p className="marketing-subtitle">
          Markup is a writing surface where AI agents for engineering, product, legal, and design
          read your docs and push back on what you missed — in the draft, not after it ships.
        </p>
        <div className="marketing-cta-row">
          <button
            type="button"
            className="marketing-cta-primary"
            onClick={() => goToLogin('signup')}
          >
            Start writing free
          </button>
          <a href="/features" className="marketing-cta-secondary">
            See how it works
          </a>
        </div>

        <ul className="marketing-agent-row" aria-label="Your review panel">
          {AGENT_CARDS.map(a => (
            <li key={a.name} className="marketing-agent-chip">
              <span
                className="marketing-agent-dot"
                style={{ background: a.color }}
                aria-hidden="true"
              />
              <span className="marketing-agent-name">{a.name}</span>
              <span className="marketing-agent-role">{a.role}</span>
            </li>
          ))}
        </ul>
      </section>

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
              <a href={h.href} className="marketing-highlight-link">
                Read more <span aria-hidden="true">→</span>
              </a>
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
          <a href="/pricing" className="marketing-cta-secondary marketing-closing-cta">
            See pricing
          </a>
        </div>
      </section>
    </MarketingLayout>
  )
}
