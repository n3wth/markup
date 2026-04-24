import { Link } from 'react-router-dom'
import { MarketingLayout } from './MarketingLayout'
import { goToLogin } from './utils'

const PILLARS = [
  {
    index: '01',
    title: 'Four perspectives, one draft',
    body: 'Engineering, product, legal, and design agents read the same document and push back where it matters — not a single generic voice averaging itself into nothing.',
    note: 'Each agent has its own system prompt, temperature, and rhythm. They disagree.',
  },
  {
    index: '02',
    title: 'Ambient, not chatbot',
    body: 'Agents live inside your document. Watch their cursors move, read their thoughts, see them edit and comment alongside you in real time — not in a side panel.',
    note: 'ProseMirror decorations. Character-by-character typing. No floating chat window.',
  },
  {
    index: '03',
    title: 'Built to disagree',
    body: 'Agents are tuned to push back, not praise. They surface gaps, risks, and weak assumptions before stakeholders do — and they are instructed to flag what is missing, not just polish what is there.',
    note: '30% pushback rate baked into the orchestrator. Banned word list. Strunk rules.',
  },
  {
    index: '04',
    title: 'Ships with presets',
    body: 'Start with PRDs, specs, briefs, or RFCs. Swap agents, rewrite personas, or bring your own. Your doc, your team — with guardrails that keep them from stepping on each other.',
    note: 'Turn-based queue. MAX_TURNS=4. MAX_EXCHANGES=4. Self-throttling.',
  },
]

const CAPABILITIES = [
  { label: 'Real-time edits', detail: 'Agents insert, replace, and comment directly in Tiptap.' },
  { label: 'Persona tuning', detail: 'Edit system prompts per agent. Save and re-use.' },
  { label: 'Turn orchestration', detail: 'One agent speaks at a time. No shouting match.' },
  { label: 'Heartbeat observations', detail: 'Proactive surface of TODOs, thin sections, open questions.' },
  { label: 'Share drafts', detail: 'Viewer, commenter, or editor — by token link.' },
  { label: 'Export anywhere', detail: 'Copy as Markdown, HTML, or plain text. No lock-in.' },
]

const FAQ = [
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
]

export function FeaturesPage() {
  return (
    <MarketingLayout pageClass="marketing-page-features" shader="cool" activePath="/features">
      <header className="marketing-page-header">
        <p className="marketing-eyebrow">Features</p>
        <h1 className="marketing-page-title">
          Not a chatbot.{' '}
          <span className="marketing-page-title-italic">A review panel.</span>
        </h1>
        <p className="marketing-page-lede">
          Markup is built on one idea: the document is the interface. Agents live
          inside it, edit alongside you, and disagree on purpose.
        </p>
      </header>

      <section className="features-pillars" aria-label="Core pillars">
        {PILLARS.map(p => (
          <article key={p.index} className="features-pillar">
            <span className="features-pillar-index">{p.index}</span>
            <div className="features-pillar-body">
              <h2 className="features-pillar-title">{p.title}</h2>
              <p className="features-pillar-copy">{p.body}</p>
              <p className="features-pillar-note">{p.note}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="features-capabilities" aria-labelledby="capabilities-title">
        <header className="marketing-section-header">
          <p className="marketing-eyebrow">Capabilities</p>
          <h2 id="capabilities-title" className="marketing-section-title">
            What you get on day one
          </h2>
        </header>
        <ul className="features-cap-grid">
          {CAPABILITIES.map(c => (
            <li key={c.label} className="features-cap-item">
              <span className="features-cap-label">{c.label}</span>
              <span className="features-cap-detail">{c.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="features-faq" aria-labelledby="features-faq-title">
        <header className="marketing-section-header">
          <p className="marketing-eyebrow">FAQ</p>
          <h2 id="features-faq-title" className="marketing-section-title">
            Common questions
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

      <section className="marketing-closing" aria-labelledby="features-closing-title">
        <h2 id="features-closing-title" className="marketing-closing-title">
          Open a draft. Invite the panel.
        </h2>
        <div className="marketing-cta-row">
          <button
            type="button"
            className="marketing-cta-primary marketing-closing-cta"
            onClick={() => goToLogin('signup')}
          >
            Start writing free
          </button>
          <Link to="/agents" className="marketing-cta-secondary marketing-closing-cta">
            Meet the agents
          </Link>
        </div>
      </section>
    </MarketingLayout>
  )
}
