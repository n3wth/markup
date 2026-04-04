import type React from 'react'

type Trend = 'up' | 'down' | 'neutral'

interface Metric {
  label: string
  value: string
  change?: string
  trend?: Trend
}

interface KeyMetricsProps {
  title?: string
  metrics: Metric[]
}

const trendColor: Record<Trend, string> = {
  up: 'var(--agent-aiden)',
  down: 'var(--agent-nova)',
  neutral: 'var(--text-tertiary)',
}

const trendSymbol: Record<Trend, string> = {
  up: '\u2191',
  down: '\u2193',
  neutral: '\u2013',
}

export const KeyMetrics: React.FC<KeyMetricsProps> = ({ title, metrics }) => {
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
      }}
    >
      {title && (
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            lineHeight: 1.3,
            marginBottom: 8,
            paddingBottom: 6,
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {title}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(metrics.length, 3)}, 1fr)`,
          gap: 8,
        }}
      >
        {metrics?.map((m, i) => (
          <div
            key={i}
            style={{
              background: 'var(--surface-3)',
              borderRadius: 8,
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                lineHeight: 1.2,
              }}
            >
              {m.label}
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
                lineHeight: 1.2,
              }}
            >
              {m.value}
            </span>
            {m.change && m.trend && (
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: trendColor[m.trend],
                  lineHeight: 1.2,
                }}
              >
                {trendSymbol[m.trend]} {m.change}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
