import type React from 'react'

type Status = 'todo' | 'in-progress' | 'done'
type Priority = 'high' | 'medium' | 'low'

interface ActionItem {
  action: string
  owner?: string
  status: Status
  priority?: Priority
}

interface ActionItemsProps {
  title?: string
  items: ActionItem[]
}

const statusColor: Record<Status, string> = {
  todo: 'var(--text-tertiary)',
  'in-progress': 'var(--agent-lex)',
  done: 'var(--agent-aiden)',
}

const statusLabel: Record<Status, string> = {
  todo: 'To do',
  'in-progress': 'In progress',
  done: 'Done',
}

const priorityColor: Record<Priority, string> = {
  high: 'var(--agent-nova)',
  medium: 'var(--agent-mira)',
  low: 'var(--agent-aiden)',
}

export const ActionItems: React.FC<ActionItemsProps> = ({ title, items }) => {
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items?.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '5px 0',
              borderBottom: i < items.length - 1
                ? '1px solid var(--border-subtle)'
                : 'none',
            }}
          >
            {/* Priority dot */}
            {item.priority && (
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: priorityColor[item.priority],
                  flexShrink: 0,
                  marginTop: 5,
                }}
              />
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  color: item.status === 'done'
                    ? 'var(--text-tertiary)'
                    : 'var(--text-primary)',
                  textDecoration: item.status === 'done' ? 'line-through' : 'none',
                  lineHeight: 1.3,
                }}
              >
                {item.action}
              </div>
              {item.owner && (
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    marginTop: 1,
                  }}
                >
                  {item.owner}
                </div>
              )}
            </div>

            {/* Status badge */}
            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: statusColor[item.status],
                background: 'var(--surface-3)',
                borderRadius: 4,
                padding: '2px 6px',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {statusLabel[item.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
