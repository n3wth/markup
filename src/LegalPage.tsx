import { MarketingLayout } from './marketing/MarketingLayout'

interface Props {
  page: 'privacy' | 'terms'
}

export function LegalPage({ page }: Props) {
  const title = page === 'privacy' ? 'Privacy Policy' : 'Terms of Service'
  const activePath = page === 'privacy' ? '/privacy' : '/terms'

  return (
    <MarketingLayout pageClass="marketing-page-legal" shader="none" activePath={activePath}>
      <div className="marketing-page-legal-inner">
        <header className="marketing-page-header">
          <p className="marketing-eyebrow">Legal</p>
          <h1 className="marketing-page-title">{title}</h1>
        </header>
        <section className="legal-content">
          {page === 'privacy' ? <PrivacyContent /> : <TermsContent />}
        </section>
      </div>
    </MarketingLayout>
  )
}

function PrivacyContent() {
  return (
    <>
      <p className="legal-date">Last updated: March 19, 2026</p>

      <h2>What we collect</h2>
      <p>When you sign in with Google, we receive your name, email address, and profile picture. We use these solely to identify you within the app.</p>

      <h2>How we use your data</h2>
      <ul>
        <li>Authenticate your account</li>
        <li>Save your documents and chat messages</li>
        <li>Display your identity to collaborators</li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t sell your data</li>
        <li>We don&apos;t serve ads</li>
        <li>We don&apos;t share your data with third parties beyond our infrastructure providers (Supabase, Vercel, Google Gemini API)</li>
      </ul>

      <h2>Data storage</h2>
      <p>Documents and messages are stored in Supabase (hosted on AWS). API keys you provide in Settings are stored in your browser&apos;s localStorage only and never sent to our servers.</p>

      <h2>Deletion</h2>
      <p>You can delete your sessions and data from within the app. To request full account deletion, email <a href="mailto:oliver@newth.ai">oliver@newth.ai</a>.</p>

      <h2>Contact</h2>
      <p><a href="mailto:oliver@newth.ai">oliver@newth.ai</a></p>
    </>
  )
}

function TermsContent() {
  return (
    <>
      <p className="legal-date">Last updated: March 19, 2026</p>

      <h2>What this is</h2>
      <p>Markup is a writing surface where AI agents for engineering, product, legal, and design read your docs and push back on what you missed. It is provided as-is for personal and professional use.</p>

      <h2>Your content</h2>
      <p>You own everything you write. We don&apos;t claim any rights to your documents or messages. Content you create may be processed by the Google Gemini API to generate AI responses.</p>

      <h2>Acceptable use</h2>
      <p>Don&apos;t use Markup to generate harmful, illegal, or abusive content. Don&apos;t attempt to exploit the service or its infrastructure.</p>

      <h2>Availability</h2>
      <p>We aim to keep Markup running but make no uptime guarantees. The service may change or shut down with reasonable notice.</p>

      <h2>Liability</h2>
      <p>Markup is provided without warranty. We are not liable for data loss, AI-generated content, or service interruptions.</p>

      <h2>Contact</h2>
      <p><a href="mailto:oliver@newth.ai">oliver@newth.ai</a></p>
    </>
  )
}
