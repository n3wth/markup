import { MarketingLayout } from './MarketingLayout'
import { goToLogin } from './utils'

type Scenario = {
  slug: string
  label: string
  headline: string
  summary: string
  before: string
  after: string
  panel: { name: string; color: string; note: string }[]
}

const SCENARIOS: Scenario[] = [
  {
    slug: 'prd',
    label: 'PRD',
    headline: 'A PRD that survives engineering review',
    summary:
      'Product requirements live or die by the questions you did not think to ask. Markup asks them before your tech lead does.',
    before: 'The user can save drafts automatically so they don\'t lose work.',
    after:
      'Aiden: "Saved where? Local storage has a 5MB ceiling. Saved how often? Every keystroke will burn quota. What happens on offline → online reconnect with stale local state?"',
    panel: [
      { name: 'Aiden', color: '#30d158', note: 'Hunts ambiguity and failure modes.' },
      { name: 'Nova', color: '#ff6961', note: 'Asks which user and why now.' },
    ],
  },
  {
    slug: 'spec',
    label: 'Spec',
    headline: 'A technical spec with honest failure modes',
    summary:
      'Specs that only describe the happy path are fiction. Markup forces you to write down what breaks.',
    before: 'The service will retry failed requests with exponential backoff.',
    after:
      'Aiden: "For how long? What\'s the cap? What happens after the cap? Is the retry idempotent? Does the caller see the first error or the last? Say the thing."',
    panel: [
      { name: 'Aiden', color: '#30d158', note: 'Probes edge cases.' },
      { name: 'Lex', color: '#64d2ff', note: 'Flags data and privacy implications.' },
    ],
  },
  {
    slug: 'brief',
    label: 'Design brief',
    headline: 'A brief that respects the user',
    summary:
      'Briefs that skip context force designers to guess. Markup pushes you to name the user, the job, and the constraint.',
    before: 'We need a clean, modern dashboard that feels premium.',
    after:
      'Mira: "Premium to whom? A CFO scanning at 7am on mobile, or an analyst in a full-screen desktop context? Those are different products. Pick one."',
    panel: [
      { name: 'Mira', color: '#ffd60a', note: 'Advocates for the actual user.' },
      { name: 'Nova', color: '#ff6961', note: 'Ties visual to business outcome.' },
    ],
  },
  {
    slug: 'rfc',
    label: 'RFC',
    headline: 'An RFC that invites real disagreement',
    summary:
      'RFCs often ship with the decision pre-baked. Markup forces the alternatives you dismissed back onto the page.',
    before: 'We propose moving to gRPC for all internal services.',
    after:
      'Aiden: "You\'re proposing a migration. What did you consider and reject? HTTP/2 + JSON? Connect-Web? Without the rejected options, this reads like a mandate, not a proposal."',
    panel: [
      { name: 'Aiden', color: '#30d158', note: 'Demands alternatives.' },
      { name: 'Lex', color: '#64d2ff', note: 'Questions vendor lock-in and contracts.' },
    ],
  },
  {
    slug: 'launch',
    label: 'Launch plan',
    headline: 'A launch plan with the risk written down',
    summary:
      'Launch plans that only describe success are marketing, not plans. Markup names what you will do when the demo flops.',
    before: 'We will announce on Tuesday, push to Product Hunt on Wednesday.',
    after:
      'Nova: "What happens if the top comment on PH is a known issue? What\'s your response tree? Who owns it? PH traffic is front-loaded — a slow first hour kills the rest."',
    panel: [
      { name: 'Nova', color: '#ff6961', note: 'Plays devil\'s advocate for rollout risk.' },
      { name: 'Lex', color: '#64d2ff', note: 'Catches claims that will need caveats.' },
    ],
  },
]

export function UseCasesPage() {
  return (
    <MarketingLayout pageClass="marketing-page-usecases" shader="sunset" activePath="/use-cases">
      <header className="marketing-page-header">
        <p className="marketing-eyebrow">Use cases</p>
        <h1 className="marketing-page-title">
          Documents that{' '}
          <span className="marketing-page-title-italic">live or die</span> in review.
        </h1>
        <p className="marketing-page-lede">
          Every doc below has the same problem: the feedback that matters arrives too late.
          Here&apos;s how Markup moves that feedback into the draft.
        </p>
      </header>

      <nav className="usecases-jump" aria-label="Jump to scenario">
        {SCENARIOS.map(s => (
          <a key={s.slug} href={`#${s.slug}`} className="usecases-jump-link">
            {s.label}
          </a>
        ))}
      </nav>

      <div className="usecases-list">
        {SCENARIOS.map((s, i) => (
          <article
            key={s.slug}
            id={s.slug}
            className={`usecases-scenario ${i % 2 === 1 ? 'is-reverse' : ''}`}
          >
            <div className="usecases-scenario-copy">
              <p className="marketing-eyebrow">{s.label}</p>
              <h2 className="usecases-scenario-title">{s.headline}</h2>
              <p className="usecases-scenario-summary">{s.summary}</p>
              <ul className="usecases-panel" aria-label="Panel">
                {s.panel.map(p => (
                  <li key={p.name} className="usecases-panel-item">
                    <span
                      className="usecases-panel-dot"
                      style={{ background: p.color }}
                      aria-hidden="true"
                    />
                    <span className="usecases-panel-name">{p.name}</span>
                    <span className="usecases-panel-note">{p.note}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="usecases-scenario-demo">
              <div className="usecases-demo-line usecases-demo-before">
                <span className="usecases-demo-label">Draft</span>
                <p>{s.before}</p>
              </div>
              <div className="usecases-demo-arrow" aria-hidden="true">↓</div>
              <div className="usecases-demo-line usecases-demo-after">
                <span className="usecases-demo-label">In the margin</span>
                <p>{s.after}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="marketing-closing">
        <h2 className="marketing-closing-title">
          Your draft, your panel.
        </h2>
        <p className="marketing-closing-sub">
          Paste in a doc. Pick your reviewers. See what you missed.
        </p>
        <button
          type="button"
          className="marketing-cta-primary marketing-closing-cta"
          onClick={() => goToLogin('signup')}
        >
          Try Markup free
        </button>
      </section>
    </MarketingLayout>
  )
}
