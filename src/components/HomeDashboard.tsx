import type { AgentConfig, DocTemplate, Session } from '../types'
import { AGENT_PRESETS } from '../lib/agent-presets'
import { TEAM_PRESETS, resolveTeam } from '../lib/agent-teams'

interface Starter {
  id: string
  title: string
  description: string
  template: DocTemplate
  agents: AgentConfig[]
}

const STARTERS: Starter[] = [
  {
    id: 'product-brief',
    title: 'Product Brief',
    description: 'Architecture review and user assumption testing.',
    template: 'prd',
    agents: [
      { name: 'Aiden', persona: AGENT_PRESETS[0].persona, owner: 'You', color: '#30d158' },
      { name: 'Nova', persona: AGENT_PRESETS[1].persona, owner: 'You', color: '#ff6961' },
    ],
  },
  {
    id: 'tech-spec',
    title: 'Technical Spec',
    description: 'System design with compliance and risk review.',
    template: 'tech-spec',
    agents: [
      { name: 'Aiden', persona: AGENT_PRESETS[0].persona, owner: 'You', color: '#30d158' },
      { name: 'Lex', persona: AGENT_PRESETS[2].persona, owner: 'You', color: '#64d2ff' },
    ],
  },
  {
    id: 'design-review',
    title: 'Design Review',
    description: 'UX advocacy and product-market fit analysis.',
    template: 'prd',
    agents: [
      { name: 'Mira', persona: AGENT_PRESETS[3].persona, owner: 'You', color: '#ffd60a' },
      { name: 'Nova', persona: AGENT_PRESETS[1].persona, owner: 'You', color: '#ff6961' },
    ],
  },
  {
    id: 'meeting-notes',
    title: 'Meeting Notes',
    description: 'Decision capture and action item extraction.',
    template: 'meeting-notes',
    agents: [
      { name: 'Nova', persona: AGENT_PRESETS[1].persona, owner: 'You', color: '#ff6961' },
      { name: 'Aiden', persona: AGENT_PRESETS[0].persona, owner: 'You', color: '#30d158' },
    ],
  },
  {
    id: 'full-team',
    title: 'Full Team',
    description: 'Engineering, product, legal, and design.',
    template: 'prd',
    agents: AGENT_PRESETS.map(p => ({
      name: p.name,
      persona: p.persona,
      owner: 'You',
      color: p.color,
    })),
  },
  {
    id: 'blank',
    title: 'Blank Canvas',
    description: 'Empty doc, your choice of agents.',
    template: 'blank',
    agents: [
      { name: 'Aiden', persona: AGENT_PRESETS[0].persona, owner: 'You', color: '#30d158' },
    ],
  },
]

interface Props {
  activeAgents?: AgentConfig[]
  sessions: Session[]
  sessionsLoaded: boolean
  onNewDoc: () => void
  onSelectSession: (session: Session) => void
  onStarterPick?: (starter: { id: string, title: string, template: DocTemplate, agents: AgentConfig[] }) => void
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function HomeDashboard({ sessions, sessionsLoaded, onNewDoc, onSelectSession, onStarterPick }: Props) {
  const continueSession = sessionsLoaded && sessions.length > 0 && sessions[0].title && sessions[0].title !== 'Untitled'
    ? sessions[0]
    : null

  return (
    <div className="home-dashboard">
      <div className="home-center">
        <div className="home-glow" />
        <h2 className="home-heading">{getGreeting()}</h2>
        <p className="home-sub">What are we writing?</p>

        {continueSession && (
          <div className="home-actions">
            <button type="button" className="home-action-btn" onClick={() => onSelectSession(continueSession)}>
              Continue: {continueSession.title}
            </button>
          </div>
        )}

        {onStarterPick ? (
          <div className="home-starters">
            {STARTERS.map(s => (
              <button type="button"
                key={s.id}
                className="home-starter-card"
                onClick={() => onStarterPick({ id: s.id, title: s.title, template: s.template, agents: s.agents })}
              >
                <div className="home-starter-dots">
                  {s.agents.slice(0, 4).map(a => (
                    <span key={a.name} className="home-starter-dot" style={{ background: a.color }} />
                  ))}
                </div>
                <span className="home-starter-title">{s.title}</span>
                <span className="home-starter-desc">{s.description}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="home-actions">
            <button type="button" className="home-action-btn home-action-primary" onClick={onNewDoc}>
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New document
            </button>
          </div>
        )}

        {onStarterPick && (
          <div className="home-teams">
            <div className="home-teams-label">Or start with a team</div>
            <div className="home-team-chips">
              {TEAM_PRESETS.map(team => {
                const agents = resolveTeam(team.id)
                if (!agents || agents.length === 0) return null
                return (
                  <button
                    type="button"
                    key={team.id}
                    className="home-team-chip"
                    title={team.description}
                    onClick={() => onStarterPick({
                      id: team.id,
                      title: team.name,
                      template: 'blank',
                      agents,
                    })}
                  >
                    <span className="home-team-emoji" aria-hidden="true">{team.emoji}</span>
                    <span className="home-team-name">{team.name}</span>
                    <span className="home-team-dots" aria-hidden="true">
                      {agents.map(a => (
                        <span key={a.name} className="home-team-dot" style={{ background: a.color }} />
                      ))}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="home-shortcuts">
          <span className="home-shortcut"><kbd>&#8984;N</kbd> New</span>
          <span className="home-shortcut"><kbd>&#8984;K</kbd> Commands</span>
        </div>
      </div>
    </div>
  )
}
