import { Streamdown } from 'streamdown'
import { MarketingLayout } from './marketing/MarketingLayout'
import changelogSource from '../CHANGELOG.md?raw'

export function ChangelogPage() {
  return (
    <MarketingLayout pageClass="marketing-page-changelog" shader="none" activePath="/changelog">
      <div className="marketing-page-changelog-inner">
        <header className="marketing-page-header">
          <p className="marketing-eyebrow">Changelog</p>
          <h1 className="marketing-page-title">What&apos;s new</h1>
        </header>
        <section className="changelog-content">
          <Streamdown>{changelogSource}</Streamdown>
        </section>
      </div>
    </MarketingLayout>
  )
}
