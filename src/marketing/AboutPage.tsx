import { MarketingLayout } from './MarketingLayout'
import { goToLogin } from './utils'

const PRINCIPLES = [
  {
    title: 'The draft is where decisions happen',
    body: 'Everything before the doc is intent. Everything after is execution. If reviewers only see polished artifacts, they review the polish — not the thinking. Markup pulls the review loop forward.',
  },
  {
    title: 'Agents should disagree',
    body: 'A model that praises every draft is worse than silence. We tune agents to flag the weakest assumption first and polish last. If they say "looks great" on every turn, they stop being useful.',
  },
  {
    title: 'The document is the interface',
    body: 'Not a chat sidebar pretending to collaborate. Agents move their cursor, insert a paragraph, leave a comment. The artifact is the conversation.',
  },
  {
    title: 'Writing rules, not writing style',
    body: 'Strunk-based writing rules and a banned-word list sit in every agent prompt. No "delve." No "leverage." No marketing mush. Clarity beats voice.',
  },
]

const TIMELINE = [
  {
    when: 'Late 2025',
    what: 'Prototype: one agent reading a Tiptap doc and proposing edits.',
  },
  {
    when: 'Early 2026',
    what: 'Turn-based orchestrator. Four agents. Real-time cursors.',
  },
  {
    when: 'Spring 2026',
    what: 'Custom personas, share links, home dashboard. Early access opens.',
  },
  {
    when: 'Today',
    what: 'You, reading an About page, wondering if this will work for your PRD. It will.',
  },
]

export function AboutPage() {
  return (
    <MarketingLayout pageClass="marketing-page-about" shader="mono" activePath="/about">
      <header className="marketing-page-header about-header">
        <p className="marketing-eyebrow">About</p>
        <h1 className="marketing-page-title">
          A small tool with{' '}
          <span className="marketing-page-title-italic">strong opinions.</span>
        </h1>
        <p className="marketing-page-lede">
          Markup was built to solve one problem: review is too late and too generic.
          By the time a draft reaches a stakeholder, the interesting questions are already baked in.
        </p>
      </header>

      <section className="about-manifesto" aria-labelledby="manifesto-title">
        <h2 id="manifesto-title" className="about-manifesto-title">
          We think most writing tools get AI wrong.
        </h2>
        <div className="about-manifesto-body">
          <p>
            Either they generate everything for you (so the thinking evaporates),
            or they polish a finished draft (so nothing ever moves). Neither is review.
          </p>
          <p>
            Review is a specialist looking at your work with a particular bias and saying
            the thing you did not want to hear — while the draft is still wet enough to change.
          </p>
          <p>
            Markup is the cheapest, fastest version of that loop we could build. It will not
            replace your actual stakeholders. It will just stop you from wasting their time.
          </p>
        </div>
      </section>

      <section className="about-principles" aria-labelledby="principles-title">
        <header className="marketing-section-header">
          <p className="marketing-eyebrow">Principles</p>
          <h2 id="principles-title" className="marketing-section-title">
            Four convictions
          </h2>
        </header>
        <ol className="about-principles-list">
          {PRINCIPLES.map((p, i) => (
            <li key={p.title} className="about-principle">
              <span className="about-principle-n">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="about-principle-title">{p.title}</h3>
              <p className="about-principle-body">{p.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="about-timeline" aria-labelledby="timeline-title">
        <header className="marketing-section-header">
          <p className="marketing-eyebrow">Timeline</p>
          <h2 id="timeline-title" className="marketing-section-title">
            How we got here
          </h2>
        </header>
        <ul className="about-timeline-list">
          {TIMELINE.map(t => (
            <li key={t.when} className="about-timeline-item">
              <span className="about-timeline-when">{t.when}</span>
              <span className="about-timeline-what">{t.what}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="about-signoff" aria-label="Signoff">
        <blockquote className="about-signoff-quote">
          <p>
            If you write PRDs, specs, RFCs, or briefs for a living — and you have
            watched them die in review — this tool is for you.
          </p>
          <footer className="about-signoff-footer">
            — Oliver, building Markup
          </footer>
        </blockquote>
        <button
          type="button"
          className="marketing-cta-primary"
          onClick={() => goToLogin('signup')}
        >
          Try it on your next draft
        </button>
      </section>
    </MarketingLayout>
  )
}
