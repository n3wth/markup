import { MarketingLayout } from './MarketingLayout'
import { goToLogin } from './utils'

type AgentProfile = {
  name: string
  role: string
  color: string
  tagline: string
  persona: string
  strengths: string[]
  tells: string[]
  sample: string
}

const AGENTS: AgentProfile[] = [
  {
    name: 'Aiden',
    role: 'Engineering',
    color: '#30d158',
    tagline: 'Pins vague specs to concrete interfaces and failure modes.',
    persona:
      'Staff engineer energy. Has shipped, has been paged, has strong feelings about retry logic. Will not sign off on a "reasonable default" without a number attached.',
    strengths: [
      'Finds ambiguity in interfaces',
      'Names failure modes',
      'Demands alternatives considered',
      'Calls out magic thresholds',
    ],
    tells: ['"Say the thing."', '"For how long?"', '"What happens when this breaks?"'],
    sample:
      '"The service will retry" is not a design. Cap the attempts, pick an idempotency story, name the observability you want.',
  },
  {
    name: 'Nova',
    role: 'Product',
    color: '#ff6961',
    tagline: 'Asks who benefits, what breaks, and where adoption stalls.',
    persona:
      'Senior PM who has watched features die after launch. Allergic to "increase engagement" without a user and a verb. Will replay your demo as the skeptical stakeholder.',
    strengths: [
      'Pressure-tests user stories',
      'Finds the edge user you forgot',
      'Names the success metric out loud',
      'Surfaces rollout risk early',
    ],
    tells: ['"Who specifically?"', '"What does this replace?"', '"What moves when this ships?"'],
    sample:
      '"Users want to save time" is not a thesis. Which users, saving which time, measured how, against what baseline?',
  },
  {
    name: 'Lex',
    role: 'Legal',
    color: '#64d2ff',
    tagline: 'Flags regulatory risk, privacy gaps, and contractual ambiguity.',
    persona:
      'In-house counsel with startup instincts. Will not tell you no; will tell you the five places where "probably fine" becomes "probably expensive."',
    strengths: [
      'Spots PII and data-handling issues',
      'Flags terms and conditions mismatch',
      'Catches unenforceable promises',
      'Names jurisdictional risk',
    ],
    tells: [
      '"Where does that data live?"',
      '"Are we promising something we can\'t deliver?"',
      '"Did we say \'guarantee\'?"',
    ],
    sample:
      'Your launch copy says "unlimited." The TOS says "fair use." Pick one, or someone else will pick for you.',
  },
  {
    name: 'Mira',
    role: 'Design',
    color: '#ffd60a',
    tagline: 'Advocates for the user and questions complexity that hurts flow.',
    persona:
      'Design lead who runs usability tests weekly. Will gently dismantle your three-step wizard. Cares about the moment the user\'s face changes.',
    strengths: [
      'Protects the golden path',
      'Questions density and nesting',
      'Names the first-run moment',
      'Flags accessibility gaps early',
    ],
    tells: ['"What does this feel like?"', '"Who does this exclude?"', '"Show me the empty state."'],
    sample:
      'Premium to whom? A CFO scanning on mobile at 7am and an analyst in a full-screen desktop context are different products. Pick one.',
  },
]

export function AgentsPage() {
  return (
    <MarketingLayout pageClass="marketing-page-agents" shader="prism" activePath="/agents">
      <header className="marketing-page-header">
        <p className="marketing-eyebrow">Agents</p>
        <h1 className="marketing-page-title">
          Your <span className="marketing-page-title-italic">panel</span>, on retainer.
        </h1>
        <p className="marketing-page-lede">
          Four specialists, one surface. Each has its own prompt, rhythm, and set of tells.
          They disagree with you, and occasionally with each other. That is the point.
        </p>
      </header>

      <div className="agents-grid">
        {AGENTS.map(a => (
          <article
            key={a.name}
            className="agents-card"
            style={{ ['--agent-accent' as string]: a.color }}
          >
            <header className="agents-card-head">
              <span className="agents-card-ring" aria-hidden="true">
                <span className="agents-card-dot" />
              </span>
              <div className="agents-card-id">
                <h2 className="agents-card-name">{a.name}</h2>
                <p className="agents-card-role">{a.role}</p>
              </div>
            </header>
            <p className="agents-card-tagline">{a.tagline}</p>
            <p className="agents-card-persona">{a.persona}</p>

            <div className="agents-card-section">
              <p className="agents-card-label">Strengths</p>
              <ul className="agents-card-list">
                {a.strengths.map(s => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="agents-card-section">
              <p className="agents-card-label">Tells</p>
              <ul className="agents-card-tells">
                {a.tells.map(t => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>

            <blockquote className="agents-card-sample">
              <p>{a.sample}</p>
              <footer>
                <span className="agents-card-sample-dot" aria-hidden="true" />
                {a.name}, in the margin
              </footer>
            </blockquote>
          </article>
        ))}
      </div>

      <section className="agents-byo" aria-labelledby="byo-title">
        <header className="marketing-section-header">
          <p className="marketing-eyebrow">Custom</p>
          <h2 id="byo-title" className="marketing-section-title">
            Bring your own
          </h2>
        </header>
        <p className="agents-byo-body">
          Presets are a starting line. Edit the system prompt, swap the rhythm,
          rename the agent — or add new ones up to four per session. The orchestrator
          keeps them turn-taking so your draft never becomes a scrum.
        </p>
        <button
          type="button"
          className="marketing-cta-primary"
          onClick={() => goToLogin('signup')}
        >
          Start with the defaults
        </button>
      </section>
    </MarketingLayout>
  )
}
