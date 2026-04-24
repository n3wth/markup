import { Sparkles, Users, FileText } from 'lucide-react'

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI Writing Assistant',
    body: 'Four specialist agents — engineering, product, legal, design — read your draft and push back in real time. Not a generic spell-checker. A standing review panel.',
  },
  {
    icon: Users,
    title: 'Real-time Collaboration',
    body: 'Watch agent cursors move through your document as they think, edit, and comment alongside you. Every suggestion lands in the draft, not a separate thread.',
  },
  {
    icon: FileText,
    title: 'Google Docs Integration',
    body: 'Export to Markdown, HTML, or plain text in one click. No lock-in, no format gymnastics — your doc stays yours.',
  },
]

export function FeaturesSection() {
  return (
    <section className="marketing-section marketing-features-section" aria-labelledby="features-section-title">
      <header className="marketing-section-header">
        <p className="marketing-eyebrow">Why Markup</p>
        <h2 id="features-section-title" className="marketing-section-title">
          Everything your draft needs
        </h2>
      </header>
      <ul className="marketing-features-grid">
        {FEATURES.map(f => {
          const Icon = f.icon
          return (
            <li key={f.title} className="marketing-features-card">
              <span className="marketing-features-icon" aria-hidden="true">
                <Icon size={22} strokeWidth={1.5} />
              </span>
              <h3 className="marketing-features-title">{f.title}</h3>
              <p className="marketing-features-body">{f.body}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
