import { MarketingLayout } from './MarketingLayout'
import { goToLogin } from './utils'

type Example = {
  slug: string
  label: string
  docType: string
  agent: string
  agentColor: string
  headline: string
  draft: string
  comment: string
}

const EXAMPLES: Example[] = [
  {
    slug: 'prd',
    label: 'Product requirements',
    docType: 'PRD',
    agent: 'Nova',
    agentColor: '#ff6961',
    headline: 'A PRD that survives the first meeting',
    draft: 'We will build a notification system to improve user engagement by sending timely alerts.',
    comment:
      '"Improve user engagement" is not a goal. What is the current engagement rate? What does the needle moving look like? Who is receiving these notifications, on which surface, and what action do you want them to take?',
  },
  {
    slug: 'rfc',
    label: 'Technical RFC',
    docType: 'RFC',
    agent: 'Aiden',
    agentColor: '#30d158',
    headline: 'A spec that names the tradeoffs',
    draft:
      'The service will use an in-memory cache to speed up repeated queries. Cache entries will be invalidated when the underlying data changes.',
    comment:
      '"When the underlying data changes" is not an invalidation strategy — it is a wish. How does the cache know data changed? What is the TTL fallback? What happens under partial failure?',
  },
  {
    slug: 'contract',
    label: 'Contract clause',
    docType: 'Legal',
    agent: 'Lex',
    agentColor: '#64d2ff',
    headline: 'Terms that mean what they say',
    draft:
      'The Company will use commercially reasonable efforts to maintain service uptime and respond to support requests in a timely manner.',
    comment:
      '"Commercially reasonable" and "timely" are undefined. What is the SLA? What is the support response window? What is the remedy if these are not met? Every undefined term is a future negotiation.',
  },
  {
    slug: 'onboarding',
    label: 'Onboarding flow',
    docType: 'UX brief',
    agent: 'Mira',
    agentColor: '#ffd60a',
    headline: 'A flow the first user can actually finish',
    draft:
      'The onboarding flow will guide new users through account setup, profile completion, and feature discovery in three steps.',
    comment:
      'What is the empty state for each step? What happens if the user skips profile completion? Three steps feels right on desktop — what does step two look like on a 375px screen at 8am?',
  },
]

export function ExamplesPage() {
  return (
    <MarketingLayout pageClass="marketing-page-examples" shader="mono" activePath="/examples">
      <header className="marketing-page-header">
        <p className="marketing-eyebrow">Examples</p>
        <h1 className="marketing-page-title">
          What it looks like{' '}
          <span className="marketing-page-title-italic">in practice.</span>
        </h1>
        <p className="marketing-page-lede">
          Four document types, four specialists. Each example shows a real draft and the
          question an agent asks before it moves on.
        </p>
      </header>

      <div className="examples-grid">
        {EXAMPLES.map(ex => (
          <article
            key={ex.slug}
            className="examples-card"
            style={{ ['--example-accent' as string]: ex.agentColor }}
          >
            <header className="examples-card-head">
              <span className="examples-card-doc-type">{ex.docType}</span>
              <span
                className="examples-card-agent-tag"
                style={{ color: ex.agentColor, borderColor: ex.agentColor }}
              >
                {ex.agent}
              </span>
            </header>
            <h2 className="examples-card-headline">{ex.headline}</h2>
            <div className="examples-card-demo">
              <div className="examples-card-draft">
                <span className="examples-card-demo-label">Draft</span>
                <p className="examples-card-draft-text">{ex.draft}</p>
              </div>
              <div className="examples-card-comment">
                <span className="examples-card-demo-label">
                  {ex.agent} in the margin
                </span>
                <p className="examples-card-comment-text">{ex.comment}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="marketing-closing">
        <h2 className="marketing-closing-title">
          Paste a draft. See what it&apos;s missing.
        </h2>
        <p className="marketing-closing-sub">
          Free while in early access. No credit card required.
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
