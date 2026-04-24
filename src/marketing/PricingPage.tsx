import { MarketingLayout } from './MarketingLayout'
import { goToLogin } from './utils'

type Tier = {
  name: string
  price: string
  cadence: string
  description: string
  featured?: boolean
  cta: { label: string; href?: string; mode?: 'signin' | 'signup' }
  features: string[]
}

const TIERS: Tier[] = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'while in early access',
    description: 'Everything you need to try the review panel on a real draft.',
    cta: { label: 'Start free', mode: 'signup' },
    features: [
      'Up to 4 agents per session',
      'All built-in presets (Aiden, Nova, Lex, Mira)',
      'Unlimited personal drafts',
      'Share links (viewer + commenter)',
      'Export as Markdown or HTML',
    ],
  },
  {
    name: 'Pro',
    price: '$18',
    cadence: 'per month',
    description: 'For writers who live in Markup. Higher limits, custom agents.',
    featured: true,
    cta: { label: 'Coming soon', mode: 'signup' },
    features: [
      'Everything in Free',
      'Custom agents + shared persona library',
      'Higher per-session turn limits',
      'Editor share-link role + branded share page',
      'Priority model routing',
      'Email support',
    ],
  },
  {
    name: 'Team',
    price: 'Custom',
    cadence: 'contact us',
    description: 'Shared workspaces, SSO, admin controls. Real infrastructure for real teams.',
    cta: { label: 'Contact sales', href: 'mailto:oliver@newth.ai?subject=Markup%20Team' },
    features: [
      'Everything in Pro',
      'Shared workspaces + seats',
      'SSO (Google, Okta)',
      'Admin roles + audit log',
      'Data residency options',
      'Dedicated Slack channel',
    ],
  },
]

const COMPARE = [
  { row: 'Agents per session', cells: ['4', '4 + custom', '4 + custom'] },
  { row: 'Turns per agent', cells: ['4', '10', '10+'] },
  { row: 'Shared workspaces', cells: ['—', '—', 'Yes'] },
  { row: 'SSO', cells: ['—', '—', 'Yes'] },
  { row: 'Admin log', cells: ['—', '—', 'Yes'] },
  { row: 'Support', cells: ['Community', 'Email', 'Dedicated'] },
]

const FAQ = [
  {
    q: 'Is Markup really free right now?',
    a: 'Yes. While in early access, the full product is free. We’ll give you at least 30 days notice before introducing paid plans.',
  },
  {
    q: 'Do I need a credit card to start?',
    a: 'No. Sign in with Google or email and start drafting. There is no trial timer.',
  },
  {
    q: 'Can I self-host?',
    a: 'Not today. The orchestrator, agents, and document store are tightly coupled. Reach out if you have a real need.',
  },
]

function ctaHandler(cta: Tier['cta']) {
  if (cta.href) {
    return () => {
      window.location.href = cta.href!
    }
  }
  return () => goToLogin(cta.mode ?? 'signup')
}

export function PricingPage() {
  return (
    <MarketingLayout pageClass="marketing-page-pricing" shader="prism" activePath="/pricing">
      <header className="marketing-page-header">
        <p className="marketing-eyebrow">Pricing</p>
        <h1 className="marketing-page-title">
          Simple while we earn it.
        </h1>
        <p className="marketing-page-lede">
          Free while in early access. Paid tiers below are directional — they give a
          sense of where we&apos;re going, not what you owe today.
        </p>
      </header>

      <section className="pricing-tiers" aria-label="Plans">
        {TIERS.map(tier => (
          <article
            key={tier.name}
            className={`pricing-tier ${tier.featured ? 'is-featured' : ''}`}
          >
            {tier.featured && <span className="pricing-tier-badge">Most loved</span>}
            <header className="pricing-tier-head">
              <h2 className="pricing-tier-name">{tier.name}</h2>
              <div className="pricing-tier-price">
                <span className="pricing-tier-amount">{tier.price}</span>
                <span className="pricing-tier-cadence">{tier.cadence}</span>
              </div>
              <p className="pricing-tier-desc">{tier.description}</p>
            </header>
            <ul className="pricing-tier-features">
              {tier.features.map(f => (
                <li key={f}>
                  <span className="pricing-check" aria-hidden="true">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={
                tier.featured
                  ? 'marketing-cta-primary pricing-tier-cta'
                  : 'marketing-cta-secondary pricing-tier-cta'
              }
              onClick={ctaHandler(tier.cta)}
            >
              {tier.cta.label}
            </button>
          </article>
        ))}
      </section>

      <section className="pricing-compare" aria-labelledby="compare-title">
        <header className="marketing-section-header">
          <p className="marketing-eyebrow">Compare</p>
          <h2 id="compare-title" className="marketing-section-title">
            Side-by-side
          </h2>
        </header>
        <div className="pricing-compare-table">
          <div className="pricing-compare-head" role="row">
            <span className="pricing-compare-cell pricing-compare-rowlabel" />
            <span className="pricing-compare-cell">Free</span>
            <span className="pricing-compare-cell">Pro</span>
            <span className="pricing-compare-cell">Team</span>
          </div>
          {COMPARE.map(r => (
            <div className="pricing-compare-row" role="row" key={r.row}>
              <span className="pricing-compare-cell pricing-compare-rowlabel">{r.row}</span>
              {r.cells.map((c, i) => (
                <span key={i} className="pricing-compare-cell">{c}</span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="pricing-faq" aria-labelledby="pricing-faq-title">
        <header className="marketing-section-header">
          <p className="marketing-eyebrow">FAQ</p>
          <h2 id="pricing-faq-title" className="marketing-section-title">
            Fine print, minus the fine
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
    </MarketingLayout>
  )
}
