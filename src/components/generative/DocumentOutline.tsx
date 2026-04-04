import type React from 'react'

interface Section {
  heading: string
  description: string
  wordTarget?: number
  depth: number
}

interface DocumentOutlineProps {
  title: string
  sections: Section[]
  totalWordTarget?: number
}

export const DocumentOutline: React.FC<DocumentOutlineProps> = ({
  title,
  sections,
  totalWordTarget,
}) => {
  return (
    <div
      style={{
        fontFamily: 'var(--font-body)',
        color: 'var(--text-primary)',
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        padding: '10px 12px',
        fontSize: 14,
        overflow: 'hidden',
      }}
    >
      {/* Title */}
      <div style={{ marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>{title}</div>
        {totalWordTarget != null && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {totalWordTarget.toLocaleString()} words target
          </div>
        )}
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sections?.map((section, i) => {
          const isTop = section.depth === 0
          return (
            <div
              key={i}
              style={{
                marginLeft: isTop ? 0 : 12,
                borderLeft: isTop
                  ? '2px solid var(--agent-aiden)'
                  : '2px solid var(--border-subtle)',
                paddingLeft: 8,
                paddingTop: 4,
                paddingBottom: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  fontWeight: isTop ? 500 : 400,
                  fontSize: isTop ? 13 : 12,
                  color: isTop ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}>
                  {section.heading}
                </span>
                {section.wordTarget != null && (
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-tertiary)',
                    background: 'var(--surface-3)',
                    borderRadius: 4,
                    padding: '1px 4px',
                  }}>
                    {section.wordTarget}w
                  </span>
                )}
              </div>
              {section.description && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.3, marginTop: 1 }}>
                  {section.description}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
