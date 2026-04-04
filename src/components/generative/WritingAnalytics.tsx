import React from 'react'

interface SectionStat {
  name: string
  wordCount: number
  percentage: number
}

interface WritingAnalyticsProps {
  wordCount: number
  readingTimeMinutes: number
  readabilityScore: number
  sections: SectionStat[]
}

const statCell = (label: string, value: string | number): React.ReactNode => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
    }}
  >
    <span
      style={{
        fontSize: 16,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-primary)',
      }}
    >
      {value}
    </span>
    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
  </div>
)

function barColor(percentage: number): string {
  if (percentage < 8) return 'var(--agent-nova)'
  if (percentage < 15) return 'var(--agent-mira)'
  return 'var(--agent-aiden)'
}

export const WritingAnalytics: React.FC<WritingAnalyticsProps> = ({
  wordCount,
  readingTimeMinutes,
  readabilityScore,
  sections,
}) => {
  return (
    <div
      style={{
        fontFamily: 'var(--font-body)',
        color: 'var(--text-primary)',
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        padding: '12px 14px',
        fontSize: 14,
      }}
    >
      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {statCell('Words', wordCount.toLocaleString())}
        {statCell('Read time', `${readingTimeMinutes}m`)}
        {statCell('Readability', readabilityScore)}
      </div>

      {/* Section balance bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {sections?.map((section, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                width: 70,
                flexShrink: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {section.name}
            </span>
            <div
              style={{
                flex: 1,
                height: 6,
                background: 'var(--surface-3)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(section.percentage, 100)}%`,
                  height: '100%',
                  background: barColor(section.percentage),
                  borderRadius: 3,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)',
                width: 32,
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {section.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
