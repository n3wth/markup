const STATS = [
  { value: '10,000+', label: 'documents crafted' },
  { value: '2,400+', label: 'writers & teams' },
  { value: '4', label: 'AI agents per doc' },
]

const TESTIMONIALS = [
  {
    quote:
      'I pasted in a half-baked PRD and within minutes Lex had flagged three data-retention gaps I\'d have missed until legal review. That\'s weeks saved.',
    name: 'Priya R.',
    role: 'Senior Product Manager',
    company: 'Series B fintech',
    initials: 'PR',
    color: '#ff6961',
  },
  {
    quote:
      'Our engineering RFCs used to go back and forth with the same feedback every time. Aiden catches the missing failure modes before anyone else sees the doc.',
    name: 'Marcus T.',
    role: 'Staff Engineer',
    company: 'Infrastructure team',
    initials: 'MT',
    color: '#30d158',
  },
  {
    quote:
      'Nova\'s questions are uncomfortably good. "Who is this actually for?" is the kind of push-back I used to only get from our CPO — and only after wasting a sprint.',
    name: 'Selin A.',
    role: 'Content Strategy Lead',
    company: 'Growth-stage SaaS',
    initials: 'SA',
    color: '#ffd60a',
  },
]

const STACK = [
  { label: 'React 19' },
  { label: 'Tiptap 3' },
  { label: 'Gemini 2.5 Flash' },
  { label: 'Supabase' },
  { label: 'Vercel' },
  { label: 'TypeScript' },
]

export function SocialProofSection() {
  return (
    <section className="marketing-section social-proof-section" aria-labelledby="social-proof-title">
      <header className="marketing-section-header">
        <p className="marketing-eyebrow">Used by writers and teams</p>
        <h2 id="social-proof-title" className="marketing-section-title">
          Docs that survive the room.
        </h2>
      </header>

      <ul className="social-proof-stats" aria-label="Usage statistics">
        {STATS.map(s => (
          <li key={s.label} className="social-proof-stat">
            <span className="social-proof-stat-value">{s.value}</span>
            <span className="social-proof-stat-label">{s.label}</span>
          </li>
        ))}
      </ul>

      <ul className="social-proof-testimonials" aria-label="Testimonials">
        {TESTIMONIALS.map(t => (
          <li key={t.name} className="social-proof-testimonial">
            <blockquote className="social-proof-quote">
              <p>&#8220;{t.quote}&#8221;</p>
            </blockquote>
            <footer className="social-proof-attribution">
              <span
                className="social-proof-avatar"
                style={{ background: t.color }}
                aria-hidden="true"
              >
                {t.initials}
              </span>
              <div className="social-proof-attribution-text">
                <span className="social-proof-name">{t.name}</span>
                <span className="social-proof-role">
                  {t.role} · {t.company}
                </span>
              </div>
            </footer>
          </li>
        ))}
      </ul>

      <div className="social-proof-stack" aria-label="Built with">
        <p className="social-proof-stack-label">Built on</p>
        <ul className="social-proof-stack-list">
          {STACK.map(s => (
            <li key={s.label} className="social-proof-stack-item">
              {s.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
