import React from 'react'

type Priority = 'high' | 'medium' | 'low'
type SuggestionType = 'add' | 'expand' | 'revise' | 'remove'

interface Suggestion {
  title: string
  description: string
  priority: Priority
  type: SuggestionType
}

interface ContentSuggestionsProps {
  suggestions: Suggestion[]
}

const priorityColor: Record<Priority, string> = {
  high: 'var(--agent-nova)',
  medium: 'var(--agent-mira)',
  low: 'var(--agent-aiden)',
}

const typeLabel: Record<SuggestionType, string> = {
  add: 'Add',
  expand: 'Expand',
  revise: 'Revise',
  remove: 'Remove',
}

export const ContentSuggestions: React.FC<ContentSuggestionsProps> = ({
  suggestions,
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
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {suggestions?.map((s, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '6px 0',
            borderBottom:
              i < suggestions.length - 1
                ? '1px solid var(--border-subtle)'
                : 'none',
          }}
        >
          {/* Priority dot */}
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: priorityColor[s.priority],
              flexShrink: 0,
              marginTop: 4,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 2,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-tertiary)',
                  background: 'var(--surface-3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1px 5px',
                }}
              >
                {typeLabel[s.type]}
              </span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {s.description}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
