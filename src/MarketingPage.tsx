import { lazy, Suspense } from 'react'
import { MarkupLogo } from './MarkupLogo'

const ColorPanels = lazy(() =>
  import('@paper-design/shaders-react').then(m => ({ default: m.ColorPanels }))
)

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

const FEATURES = [
  {
    title: 'Four perspectives, one draft',
    body: 'Engineering, product, legal, and design agents read the same document and push back where it matters — not a single generic voice.',
  },
  {
    title: 'Ambient, not chatbot',
    body: 'Agents live inside your document. Watch their cursors move, read their thoughts, see them edit and comment in real time.',
  },
  {
    title: 'Built to disagree',
    body: 'Agents are tuned to push back, not praise. They surface gaps, risks, and weak assumptions before stakeholders do.',
  },
  {
    title: 'Ships with presets',
    body: 'Start with PRDs, specs, briefs, or RFCs. Swap agents, rewrite personas, or bring your own. Your doc, your team.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Start a draft',
    body: 'Pick a template or paste in what you have — PRD, spec, brief, launch plan.',
  },
  {
    n: '02',
    title: 'Pick your reviewers',
    body: 'Aiden, Nova, Lex, Mira — or a subset. Tune each persona if you want.',
  },
  {
    n: '03',
    title: 'Ship with fewer surprises',
    body: 'Agents read, challenge, and edit alongside you until the draft holds up.',
  },
]

const FAQ = [
  {
    q: 'What does Markup actually do?',
    a: 'Markup is a shared writing surface where AI agents with distinct specialties review and edit your document alongside you. Think less "AI writes for me" and more "a standing review panel that works at draft speed."',
  },
  {
    q: 'Who is this for?',
    a: 'Product managers, engineers, and founders who write PRDs, specs, RFCs, and briefs — the kind of document that lives or dies by the feedback it gets before it ships.',
  },
  {
    q: 'Which models do the agents use?',
    a: 'Agents run on Google Gemini 2.5 Flash today. Each agent has its own system prompt and rhythm so their feedback reads distinct instead of averaged.',
  },
  {
    q: 'Can I change the agents?',
    a: 'Yes. You can swap presets, edit personas, or add up to four agents per session. The underlying orchestration keeps them from stepping on each other.',
  },
  {
    q: 'Is my writing used to train anything?',
    a: 'No. Your documents stay in your account. Drafts and chat are stored per-session and are not used to train models.',
  },
  {
    q: 'How much does it cost?',
    a: 'Markup is free while in early access. Sign in with Google or email and start drafting.',
  },
]

export function MarketingPage() {
  const goToLogin = (mode: 'signin' | 'signup' = 'signin') => {
    const target = mode === 'signup' ? '/?login=1&mode=signup' : '/?login=1'
    window.location.href = target
  }

  return (
    <div className="marketing-page">
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
            colors={['#FF9D00', '#FD4F30', '#809BFF', '#6D2EFF', '#333AFF', '#F15CFF', '#FFD557']}
            colorBack="#00000000"
            style={{ height: '100%', width: '100%', mixBlendMode: 'screen', opacity: 0.45 }}
          />
        </Suspense>
      </div>

      <nav className="marketing-nav" aria-label="Primary">
        <a href="/" className="marketing-nav-logo" aria-label="Markup home">
          <MarkupLogo height={20} />
        </a>
        <div className="marketing-nav-links">
          <a href="#features" className="marketing-nav-link">Features</a>
          <a href="#how" className="marketing-nav-link">How it works</a>
          <a href="#faq" className="marketing-nav-link">FAQ</a>
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

      <main className="marketing-main">
        <section className="marketing-hero" aria-labelledby="hero-headline">
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
            <button
              type="button"
              className="marketing-cta-secondary"
              onClick={() => {
                const el = document.getElementById('features')
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              See how it works
            </button>
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

        <section id="features" className="marketing-section" aria-labelledby="features-title">
          <header className="marketing-section-header">
            <p className="marketing-eyebrow">Features</p>
            <h2 id="features-title" className="marketing-section-title">
              A standing review panel, at draft speed
            </h2>
          </header>
          <ul className="marketing-feature-grid">
            {FEATURES.map(f => (
              <li key={f.title} className="marketing-feature-card">
                <h3 className="marketing-feature-title">{f.title}</h3>
                <p className="marketing-feature-body">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="how" className="marketing-section" aria-labelledby="how-title">
          <header className="marketing-section-header">
            <p className="marketing-eyebrow">How it works</p>
            <h2 id="how-title" className="marketing-section-title">
              Three steps, no setup theatre
            </h2>
          </header>
          <ol className="marketing-steps">
            {STEPS.map(s => (
              <li key={s.n} className="marketing-step">
                <span className="marketing-step-n">{s.n}</span>
                <h3 className="marketing-step-title">{s.title}</h3>
                <p className="marketing-step-body">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="faq" className="marketing-section" aria-labelledby="faq-title">
          <header className="marketing-section-header">
            <p className="marketing-eyebrow">FAQ</p>
            <h2 id="faq-title" className="marketing-section-title">
              Questions, answered
            </h2>
          </header>
          <div className="marketing-faq">
            {FAQ.map(item => (
              <details key={item.q} className="marketing-faq-item">
                <summary className="marketing-faq-q">{item.q}</summary>
                <p className="marketing-faq-a">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="marketing-closing" aria-labelledby="closing-title">
          <h2 id="closing-title" className="marketing-closing-title">
            Ship drafts that survive the room.
          </h2>
          <p className="marketing-closing-sub">
            Free while in early access. No credit card, no onboarding call.
          </p>
          <button
            type="button"
            className="marketing-cta-primary marketing-closing-cta"
            onClick={() => goToLogin('signup')}
          >
            Start writing free
          </button>
        </section>
      </main>

      <footer className="marketing-footer">
        <div className="marketing-footer-inner">
          <a href="/" className="marketing-footer-logo" aria-label="Markup home">
            <MarkupLogo height={18} />
          </a>
          <nav className="marketing-footer-links" aria-label="Footer">
            <a href="/privacy" className="marketing-footer-link">Privacy</a>
            <a href="/terms" className="marketing-footer-link">Terms</a>
            <a href="/changelog" className="marketing-footer-link">Changelog</a>
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
