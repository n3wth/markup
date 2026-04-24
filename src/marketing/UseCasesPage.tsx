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
    slug: 'blog',
    label: 'Blog writing',
    headline: 'A post worth reading, not just publishing',
    summary:
      'Most blog posts bury the point or never make one. Markup surfaces the argument before you hit publish.',
    before: 'AI is changing the way we work. Here\'s what you need to know about the future of productivity.',
    after:
      'Nova: "What\'s the actual claim? \'AI is changing work\' is not a thesis. Who is this for? What do you want them to do after reading it? Start with the one thing you\'re arguing."',
    panel: [
      { name: 'Nova', color: '#ff6961', note: 'Sharpens the argument and audience.' },
      { name: 'Mira', color: '#ffd60a', note: 'Checks that the opening earns the read.' },
    ],
  },
  {
    slug: 'technical-docs',
    label: 'Technical docs',
    headline: 'Docs that answer the question before it\'s asked',
    summary:
      'Technical documentation fails when it describes what a thing is without explaining why you\'d use it. Markup fills the gap.',
    before: 'The `sync()` method synchronizes the local state with the remote store.',
    after:
      'Aiden: "When should you call this? What happens if you call it twice? What does it return on a conflict? Add a usage example — the type signature alone does not answer when to use it."',
    panel: [
      { name: 'Aiden', color: '#30d158', note: 'Catches missing context and edge cases.' },
      { name: 'Nova', color: '#ff6961', note: 'Asks what the developer is actually trying to do.' },
    ],
  },
  {
    slug: 'meeting-notes',
    label: 'Meeting notes',
    headline: 'Notes that capture decisions, not just words',
    summary:
      'Meeting notes that read like transcripts are worse than nothing. Markup turns talk into traceable decisions.',
    before: 'The team discussed the Q3 roadmap and agreed on some priorities for the next quarter.',
    after:
      'Nova: "What was decided? Who owns it? By when? \'Agreed on some priorities\' does not give anyone a next action. List the decisions and their owners or the meeting didn\'t happen."',
    panel: [
      { name: 'Nova', color: '#ff6961', note: 'Pins vague agreements to owners and dates.' },
      { name: 'Lex', color: '#64d2ff', note: 'Flags commitments that carry legal weight.' },
    ],
  },
  {
    slug: 'code-docs',
    label: 'Code documentation',
    headline: 'Comments that explain the why, not the what',
    summary:
      'Code comments that restate the code add noise. Markup finds the places where the invariant is the story.',
    before: '// Increments the counter by 1\ncounter++',
    after:
      'Aiden: "The code already says this. What\'s the invariant? Is there a race condition on counter? Is this ever called from a non-UI thread? The comment should say what the code can\'t."',
    panel: [
      { name: 'Aiden', color: '#30d158', note: 'Hunts for the hidden constraint.' },
      { name: 'Mira', color: '#ffd60a', note: 'Checks that the doc is useful to the next reader.' },
    ],
  },
  {
    slug: 'seo',
    label: 'SEO content',
    headline: 'Pages that rank because they deserve to',
    summary:
      'SEO content that optimizes for keywords and ignores the reader ends up serving neither. Markup pushes you to answer the question for real.',
    before: 'Project management software helps teams manage projects. The best project management software includes features for task management.',
    after:
      'Nova: "You\'re optimizing for a keyword and not answering anything. What does someone searching this actually want to know? Answer that. The ranking follows from the answer."',
    panel: [
      { name: 'Nova', color: '#ff6961', note: 'Asks what the search intent actually is.' },
      { name: 'Mira', color: '#ffd60a', note: 'Flags copy that will lose the reader in the first scroll.' },
    ],
  },
  {
    slug: 'social',
    label: 'Social media copy',
    headline: 'Posts that earn the share',
    summary:
      'Social copy that hedges everything says nothing. Markup pushes you to make the claim and stand behind it.',
    before: 'Excited to share that we\'ve been working on something we think you might find interesting! Stay tuned for more.',
    after:
      'Nova: "You\'ve said nothing. What is it? Who is it for? Why does it exist? If you can\'t write a sentence with a subject and a verb about what you shipped, you\'re not ready to post."',
    panel: [
      { name: 'Nova', color: '#ff6961', note: 'Demands a real claim, not a tease.' },
      { name: 'Lex', color: '#64d2ff', note: 'Catches claims that can\'t be substantiated.' },
    ],
  },
]

export function UseCasesPage() {
  return (
    <MarketingLayout pageClass="marketing-page-usecases" shader="sunset" activePath="/use-cases">
      <header className="marketing-page-header">
        <p className="marketing-eyebrow">Use cases</p>
        <h1 className="marketing-page-title">
          Writing that{' '}
          <span className="marketing-page-title-italic">says something.</span>
        </h1>
        <p className="marketing-page-lede">
          Every type of writing below has the same failure mode: it ships before the hard questions
          get asked. Markup asks them in the draft.
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
          Paste a draft. See what it&apos;s missing.
        </h2>
        <p className="marketing-closing-sub">
          Markup works on any kind of writing. Free while in early access.
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
