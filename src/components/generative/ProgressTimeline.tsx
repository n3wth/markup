import type React from 'react'

type PhaseStatus = 'done' | 'current' | 'upcoming'

interface Phase {
  name: string
  description: string
  status: PhaseStatus
}

interface ProgressTimelineProps {
  title: string
  phases: Phase[]
}

const statusColor: Record<PhaseStatus, string> = {
  done: 'var(--agent-aiden)',
  current: 'var(--agent-lex)',
  upcoming: 'var(--text-tertiary)',
}

export const ProgressTimeline: React.FC<ProgressTimelineProps> = ({ title, phases }) => {
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

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {phases?.map((phase, i) => {
          const color = statusColor[phase.status]
          const isLast = i === phases.length - 1
          return (
            <div key={i} style={{ display: 'flex', gap: 10 }}>
              {/* Timeline rail */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: 12,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: phase.status === 'current' ? 10 : 8,
                    height: phase.status === 'current' ? 10 : 8,
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                    marginTop: 3,
                  }}
                />
                {!isLast && (
                  <div
                    style={{
                      width: 1.5,
                      flex: 1,
                      background: 'var(--border-default)',
                      minHeight: 16,
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div style={{ paddingBottom: isLast ? 0 : 10, flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: phase.status === 'current' ? 600 : 400,
                    color: phase.status === 'upcoming'
                      ? 'var(--text-tertiary)'
                      : 'var(--text-primary)',
                    lineHeight: 1.3,
                  }}
                >
                  {phase.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                    lineHeight: 1.3,
                    marginTop: 1,
                  }}
                >
                  {phase.description}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
