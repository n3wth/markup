import type React from 'react'

type Priority = 'critical' | 'important' | 'nice-to-have'

interface ChecklistItem {
  text: string
  checked: boolean
  priority?: Priority
}

interface ChecklistProps {
  title: string
  items: ChecklistItem[]
}

const priorityColor: Record<Priority, string> = {
  critical: 'var(--agent-nova)',
  important: 'var(--agent-mira)',
  'nice-to-have': 'var(--agent-aiden)',
}

export const Checklist: React.FC<ChecklistProps> = ({ title, items }) => {
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items?.map((item, i) => {
          const color = item.priority ? priorityColor[item.priority] : 'var(--text-tertiary)'
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 0',
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  border: `1.5px solid ${color}`,
                  background: item.checked ? color : 'transparent',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.checked && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3.2 5.7L6.5 2.3" stroke="var(--surface-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: item.checked ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  textDecoration: item.checked ? 'line-through' : 'none',
                  flex: 1,
                  lineHeight: 1.3,
                }}
              >
                {item.text}
              </span>
              {item.priority && (
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    color,
                    flexShrink: 0,
                  }}
                >
                  {item.priority}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
