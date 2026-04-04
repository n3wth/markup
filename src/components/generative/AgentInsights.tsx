import React from 'react'

type Status = 'positive' | 'neutral' | 'concern'

interface Insight {
  agentName: string
  status: Status
  summary: string
  confidence: number
}

interface AgentInsightsProps {
  insights: Insight[]
}

const agentColorVar: Record<string, string> = {
  aiden: 'var(--agent-aiden)',
  nova: 'var(--agent-nova)',
  lex: 'var(--agent-lex)',
  mira: 'var(--agent-mira)',
}

function getAgentColor(name: string): string {
  const key = name.toLowerCase()
  return agentColorVar[key] ?? 'var(--text-secondary)'
}

const statusIcon: Record<Status, string> = {
  positive: '+',
  neutral: '~',
  concern: '!',
}

const statusColor: Record<Status, string> = {
  positive: 'var(--agent-aiden)',
  neutral: 'var(--text-tertiary)',
  concern: 'var(--agent-nova)',
}

export const AgentInsights: React.FC<AgentInsightsProps> = ({ insights }) => {
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
        gap: 8,
      }}
    >
      {insights?.map((insight, i) => {
        const color = getAgentColor(insight.agentName)
        return (
          <div
            key={i}
            style={{
              borderLeft: `2px solid ${color}`,
              paddingLeft: 10,
              paddingTop: 2,
              paddingBottom: 2,
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color }}>
                {insight.agentName}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: statusColor[insight.status],
                }}
              >
                {statusIcon[insight.status]}
              </span>
              {/* Confidence bar */}
              <div
                style={{
                  flex: 1,
                  height: 4,
                  background: 'var(--surface-3)',
                  borderRadius: 2,
                  overflow: 'hidden',
                  maxWidth: 60,
                  marginLeft: 'auto',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(insight.confidence, 100)}%`,
                    height: '100%',
                    background: color,
                    borderRadius: 2,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-tertiary)',
                }}
              >
                {insight.confidence}%
              </span>
            </div>
            {/* Summary */}
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {insight.summary}
            </span>
          </div>
        )
      })}
    </div>
  )
}
