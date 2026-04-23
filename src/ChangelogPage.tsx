import { Streamdown } from 'streamdown'
import { BlobAvatar } from './blob-avatar'
import changelogSource from '../CHANGELOG.md?raw'

export function ChangelogPage() {
  return (
    <div className="home">
      <div className="home-inner">
        <nav className="home-nav">
          <div className="home-nav-logo">
            <a href="/" className="home-nav-logo-link">
              <div className="home-nav-blob-wrap">
                <BlobAvatar name="Collab" size={24} state="logo" color="#30d158" />
              </div>
              <span className="home-nav-wordmark">Collab</span>
            </a>
          </div>
        </nav>

        <section className="legal-content">
          <Streamdown>{changelogSource}</Streamdown>
        </section>

        <footer className="home-footer">
          <div className="home-footer-left">
            <span className="home-footer-brand">Collab</span>
          </div>
          <div className="home-footer-right">
            <a href="/privacy" className="home-footer-link">Privacy</a>
            <a href="/terms" className="home-footer-link">Terms</a>
            <span className="home-footer-copy">Built by n3wth</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
