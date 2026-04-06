import type { AgentConfig, Session } from '../types'

interface Props {
  activeAgents: AgentConfig[]
  sessions: Session[]
  sessionsLoaded: boolean
  onNewDoc: () => void
  onSelectSession: (session: Session) => void
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function HomeDashboard({ activeAgents, sessions, sessionsLoaded, onNewDoc, onSelectSession }: Props) {
  const continueSession = sessionsLoaded && sessions.length > 0 && sessions[0].title && sessions[0].title !== 'Untitled'
    ? sessions[0]
    : null

  return (
    <div className="home-dashboard">
      <div className="home-center">
        <div className="home-glow" />
        <div className="home-dots">
          {activeAgents.slice(0, 4).map(a => (
            <span key={a.name} className="home-dot" style={{ background: a.color }} title={a.name} />
          ))}
        </div>
        <h2 className="home-heading">{getGreeting()}</h2>
        <p className="home-sub">{activeAgents.length} agent{activeAgents.length !== 1 ? 's' : ''} ready to collaborate</p>
        <div className="home-actions">
          <button className="home-action-btn home-action-primary" onClick={onNewDoc}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New document
          </button>
          {continueSession && (
            <button className="home-action-btn" onClick={() => onSelectSession(continueSession)}>
              Continue: {continueSession.title}
            </button>
          )}
        </div>
        <div className="home-shortcuts">
          <span className="home-shortcut"><kbd>&#8984;N</kbd> New</span>
          <span className="home-shortcut"><kbd>&#8984;K</kbd> Commands</span>
        </div>
      </div>
    </div>
  )
}
