import React from 'react'

interface Result {
  title: string
  snippet: string
  relevance: number
  source?: string
}

interface ResearchResultsProps {
  query: string
  results: Result[]
  summary?: string
}

function relevanceColor(relevance: number): string {
  if (relevance >= 80) return 'var(--agent-aiden)'
  if (relevance >= 50) return 'var(--agent-mira)'
  return 'var(--text-tertiary)'
}

export const ResearchResults: React.FC<ResearchResultsProps> = ({
  query,
  results,
  summary,
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
      {/* Query */}
      <div style={{ marginBottom: summary ? 8 : 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          Research:{' '}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {query}
        </span>
      </div>

      {/* Summary */}
      {summary && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            marginBottom: 10,
            paddingBottom: 8,
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {summary}
        </div>
      )}

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {results?.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '5px 0',
              borderBottom:
                i < results.length - 1
                  ? '1px solid var(--border-subtle)'
                  : 'none',
            }}
          >
            {/* Relevance indicator */}
            <div
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: relevanceColor(r.relevance),
                flexShrink: 0,
                marginTop: 5,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                  marginBottom: 2,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>{r.title}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: relevanceColor(r.relevance),
                  }}
                >
                  {r.relevance}%
                </span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {r.snippet}
              </span>
              {r.source && (
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    marginTop: 2,
                  }}
                >
                  {r.source}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
