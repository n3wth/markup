import { MarketingLayout } from './marketing/MarketingLayout'
import changelogSource from '../CHANGELOG.md?raw'

type ChangelogCategory = {
  name: string
  items: string[]
}

type ChangelogEntry = {
  date: string
  categories: ChangelogCategory[]
  isCatchAll?: boolean
  catchAllItems?: string[]
}

function parseChangelog(src: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  const lines = src.split('\n')

  let current: ChangelogEntry | null = null
  let currentCat: ChangelogCategory | null = null

  for (const line of lines) {
    const h2 = line.match(/^## (.+)/)
    if (h2) {
      if (current) {
        if (currentCat && currentCat.items.length > 0) current.categories.push(currentCat)
        entries.push(current)
        currentCat = null
      }
      const label = h2[1].trim()
      const isCatchAll = !/^\d{4}-\d{2}-\d{2}$/.test(label)
      current = { date: label, categories: [], isCatchAll, catchAllItems: [] }
      continue
    }

    if (!current) continue

    const bold = line.match(/^\*\*(.+)\*\*$/)
    if (bold) {
      if (currentCat && currentCat.items.length > 0) current.categories.push(currentCat)
      currentCat = { name: bold[1].trim(), items: [] }
      continue
    }

    const bullet = line.match(/^- (.+)/)
    if (bullet) {
      const text = bullet[1].replace(/`([^`]+)`/g, '$1')
      if (currentCat) {
        currentCat.items.push(text)
      } else if (current.isCatchAll) {
        current.catchAllItems!.push(text)
      }
    }
  }

  if (current) {
    if (currentCat && currentCat.items.length > 0) current.categories.push(currentCat)
    entries.push(current)
  }

  return entries
}

const ENTRIES = parseChangelog(changelogSource)

export function ChangelogPage() {
  return (
    <MarketingLayout pageClass="marketing-page-changelog" shader="cool" activePath="/changelog">
      <header className="marketing-page-header changelog-header">
        <p className="marketing-eyebrow">Changelog</p>
        <h1 className="marketing-page-title">What's new in Markup</h1>
        <p className="marketing-page-lede">
          Dated, not numbered. Each entry captures user-visible and developer-visible
          shifts — routine refactors aren't listed.
        </p>
      </header>

      <section className="changelog-feed" aria-label="Product updates">
        {ENTRIES.map((entry) => (
          <article key={entry.date} className="changelog-entry">
            <div className="changelog-entry-date">{entry.date}</div>
            <div className="changelog-entry-body">
              {entry.isCatchAll ? (
                <>
                  {entry.catchAllItems && entry.catchAllItems.length > 0 && (
                    <ul className="changelog-items">
                      {entry.catchAllItems.map((item, i) => (
                        <li key={i} className="changelog-item">{item}</li>
                      ))}
                    </ul>
                  )}
                  {entry.categories.map((cat) => (
                    <div key={cat.name} className="changelog-category">
                      <h3 className="changelog-category-name">{cat.name}</h3>
                      <ul className="changelog-items">
                        {cat.items.map((item, i) => (
                          <li key={i} className="changelog-item">{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              ) : (
                entry.categories.map((cat) => (
                  <div key={cat.name} className="changelog-category">
                    <h3 className="changelog-category-name">{cat.name}</h3>
                    <ul className="changelog-items">
                      {cat.items.map((item, i) => (
                        <li key={i} className="changelog-item">{item}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </article>
        ))}
      </section>
    </MarketingLayout>
  )
}
