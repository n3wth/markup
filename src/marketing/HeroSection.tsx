import { memo } from 'react'
import { goToLogin } from './utils'
import './HeroSection.css'

export const HeroSection = memo(() => {
  return (
    <section className="marketing-hero-new" aria-labelledby="hero-headline">
      <div className="hero-background-blobs" aria-hidden="true">
        <div className="hero-blob hero-blob-1" />
        <div className="hero-blob hero-blob-2" />
        <div className="hero-blob hero-blob-3" />
      </div>

      <div className="hero-content">
        <span className="hero-pill">Early access · free while it lasts</span>
        <h1 id="hero-headline" className="hero-headline">
          <span className="hero-headline-line">The AI writing assistant</span>
          <span className="hero-headline-line hero-headline-italic">that actually pushes back.</span>
        </h1>
        <p className="hero-subtitle">
          Markup gives you instant feedback from engineering, product, legal, and design experts
          — in the draft, not after it ships.
        </p>
        
        <div className="hero-cta-row">
          <button
            type="button"
            className="marketing-cta-primary hero-cta-btn"
            onClick={() => goToLogin('signup')}
          >
            Get Started Free
          </button>
          <button
            type="button"
            className="marketing-cta-secondary hero-cta-btn"
            onClick={() => {
                const el = document.querySelector('.marketing-highlights');
                el?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            See it in action
          </button>
        </div>

        <div className="hero-media">
          <div className="hero-mock-editor">
            <div className="mock-editor-header">
              <div className="mock-dots">
                <span />
                <span />
                <span />
              </div>
              <div className="mock-title">Product_Spec_v2.md</div>
              <div className="mock-agents">
                <div className="mock-agent aiden" />
                <div className="mock-agent nova" />
                <div className="mock-agent lex" />
                <div className="mock-agent mira" />
              </div>
            </div>
            <div className="mock-editor-body">
              <div className="mock-line"># Authentication Strategy</div>
              <div className="mock-line">We will use JWT-based auth for the MVP.</div>
              <div className="mock-line mock-highlight">
                Tokens will be stored in local storage for simplicity.
                <div className="mock-comment lex-comment">
                  <strong>Lex:</strong> Security risk. Use HttpOnly cookies instead.
                </div>
              </div>
              <div className="mock-line">The API will expose a /login endpoint.</div>
              <div className="mock-line mock-highlight">
                 All requests will be over HTTP.
                 <div className="mock-comment aiden-comment">
                  <strong>Aiden:</strong> HTTPS is mandatory, even for local dev.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
})
