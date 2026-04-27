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

type Feature = {
  icon: React.ReactNode
  title: string
  description: string
  detail: string
  accent: string
}

const FEATURES: Feature[] = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M3 17L7.5 6.5L12 17M5.5 13h5M15 6v11M15 6c1.5 0 3.5.5 3.5 2.75S16.5 11.5 15 11.5m0 0c1.5 0 3.5.5 3.5 2.75S16.5 17 15 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'AI writing assistant',
    description: 'Four specialist agents that edit your document in real time — not suggestions in a sidebar.',
    detail: 'Each agent carries a distinct system prompt and rate. They insert, replace, and comment directly in the editor, character by character, with visible cursors and thought bubbles so you can watch the reasoning as it happens.',
    accent: '#30d158',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="6" cy="11" r="2" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="16" cy="6" r="2" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="16" cy="16" r="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 10.5L14 7M8 11.5L14 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Real-time collaboration',
    description: 'Multiple agents work the same document without stepping on each other.',
    detail: 'A turn-based orchestrator queues agent actions so edits never collide. Each agent has a unique cursor decoration, colour-coded presence, and a thought bubble that shows what it\'s about to do before it acts.',
    accent: '#64d2ff',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 8h4M7 11h8M7 14h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Google Docs integration',
    description: 'Pull any Google Doc directly into a Markup session — agents get the full text.',
    detail: 'Paste a Doc URL or pick from your Drive. The content is fetched and loaded into the editor. Agents can then read, annotate, and rewrite sections without you having to copy-paste anything.',
    accent: '#ff6961',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M11 3v2M11 17v2M3 11h2M17 11h2M5.6 5.6l1.4 1.4M14.9 14.9l1.4 1.4M5.6 16.4l1.4-1.4M14.9 7.1l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="11" cy="11" r="3" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    title: 'Agent memory',
    description: 'Agents build context across the session — they remember what they read and said.',
    detail: 'The full chat and document history travels with each agent turn. Proactive heartbeat observations surface TODOs, thin sections, and open questions without being asked. Agents get smarter as the doc grows.',
    accent: '#bf5af2',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M5 4h12a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 8h2.5M7 11h5M7 14h3.5M12.5 11L14 8l1.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Markdown export',
    description: 'Copy or download your document as clean Markdown, HTML, or plain text.',
    detail: 'No lock-in. Every document can leave Markup in the format you need. The exporter strips editor metadata and produces clean prose — ready for your CMS, your repo, or your clipboard.',
    accent: '#ffd60a',
  },
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
  {
    q: 'Does the Google Docs integration require a sign-in?',
    a: 'Google Drive access uses your existing Google OAuth session — the same one you use to sign into Markup. No additional setup required.',
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

      <section className="features-spotlight" aria-labelledby="spotlight-title">
        <header className="marketing-section-header">
          <p className="marketing-eyebrow">What you get</p>
          <h2 id="spotlight-title" className="marketing-section-title">
            Five things that change how you write
          </h2>
        </header>
        <ul className="features-spotlight-grid" role="list">
          {FEATURES.map((f, i) => (
            <li
              key={f.title}
              className={`features-spotlight-card${i === 4 ? ' features-spotlight-card--wide' : ''}`}
              style={{ ['--feature-accent' as string]: f.accent }}
            >
              <span className="features-spotlight-icon">{f.icon}</span>
              <h3 className="features-spotlight-title">{f.title}</h3>
              <p className="features-spotlight-desc">{f.description}</p>
              <p className="features-spotlight-detail">{f.detail}</p>
            </li>
          ))}
        </ul>
      </section>

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
          <a href="/agents" className="marketing-cta-secondary marketing-closing-cta">
            Meet the agents
          </a>
        </div>
      </section>
    </MarketingLayout>
  )
}
