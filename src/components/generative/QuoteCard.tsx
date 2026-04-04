import type React from 'react'

type QuoteType = 'highlight' | 'warning' | 'question' | 'insight'

interface QuoteCardProps {
  quote: string
  source?: string
  context?: string
  type: QuoteType
}

const typeColor: Record<QuoteType, string> = {
  highlight: 'var(--agent-lex)',
  warning: 'var(--agent-nova)',
  question: 'var(--agent-mira)',
  insight: 'var(--agent-aiden)',
}

const typeLabel: Record<QuoteType, string> = {
  highlight: 'Highlight',
  warning: 'Warning',
  question: 'Question',
  insight: 'Insight',
}

export const QuoteCard: React.FC<QuoteCardProps> = ({ quote, source, context, type }) => {
  const color = typeColor[type]

  return (
    <div
      style={{
        fontFamily: 'var(--font-body)',
        color: 'var(--text-primary)',
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        borderLeft: `3px solid ${color}`,
        padding: '10px 12px',
        fontSize: 14,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 6,
        }}
      >
        {typeLabel[type]}
      </div>

      <div
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--text-primary)',
          fontStyle: 'italic',
        }}
      >
        {quote}
      </div>

      {source && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            marginTop: 6,
          }}
        >
          {source}
        </div>
      )}

      {context && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            marginTop: 4,
            lineHeight: 1.3,
          }}
        >
          {context}
        </div>
      )}
    </div>
  )
}
