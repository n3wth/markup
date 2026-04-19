import { BlobAvatar } from '../blob-avatar'
import { AgentHoverCard } from './AgentHoverCard'
import { AgentConfigurator } from '../AgentConfigurator'
import { AGENT_DESCRIPTIONS } from './AgentHoverCard'
import { saveAgentPersonas } from '../lib/session-store'
import { agentConfigsToPersonas } from '../lib/agent-personas'
import type { AgentConfig, AgentState, Session } from '../types'

interface SessionHeaderProps {
  activeSession: Session
  activeAgents: AgentConfig[]
  getAgentState: (name: string) => AgentState
  agentsPaused: boolean
  onTogglePause: () => void
  chatWidth: number
  saveStatus: 'saved' | 'saving' | 'idle'
  showConfigurator: boolean
  onToggleConfigurator: () => void
  onAgentsChange: (agents: AgentConfig[]) => void
  activeSessionRef: React.RefObject<Session | null>
  isViewMode?: boolean
  onOpenShare?: () => void
}

export function SessionHeader({
  activeSession,
  activeAgents,
  getAgentState,
  agentsPaused,
  onTogglePause,
  chatWidth,
  saveStatus,
  showConfigurator,
  onToggleConfigurator,
  onAgentsChange,
  activeSessionRef,
  isViewMode = false,
  onOpenShare,
}: SessionHeaderProps) {

  return (
    <>
      <div className="app-header">
        <div className="header-editor-zone">
          <span className="header-doc-title">{activeSession.title}</span>
          {isViewMode && <span className="header-view-badge" title="Read-only spectator link. Edits are disabled and agents are paused.">Viewing</span>}
          {!isViewMode && saveStatus === 'saving' && <span className="header-save-status">Saving...</span>}
          {!isViewMode && saveStatus === 'saved' && <span className="header-save-status saved">Saved</span>}
        </div>
        <div className="header-chat-zone" style={{ width: chatWidth + 4 }}>
          {!isViewMode && <button
            type="button"
            className="header-share-btn"
            onClick={onOpenShare}
            title="Share this document"
            aria-label="Share document"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
              <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
            </svg>
          </button>}
          {!isViewMode && <button type="button"
            className={`header-pause-btn ${agentsPaused ? 'paused' : ''}`}
            onClick={onTogglePause}
            title={agentsPaused ? 'Resume agents' : 'Pause agents'}
            aria-label={agentsPaused ? 'Resume agents' : 'Pause agents'}
          >
            {agentsPaused ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                <polygon points="6,4 20,12 6,20" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                <rect x="5" y="4" width="5" height="16" rx="1" />
                <rect x="14" y="4" width="5" height="16" rx="1" />
              </svg>
            )}
          </button>}
          <div className="header-participants">
            {activeAgents.map((agent, idx) => {
              const agentState = getAgentState(agent.name)
              return (
                <div key={agent.name} className="header-avatar-wrap">
                  <BlobAvatar name={agent.name} size={18} state={agentState.status} />
                  <AgentHoverCard
                    name={agent.name}
                    agentState={agentState}
                    agentConfig={agent}
                    onRemove={activeAgents.length > 1 ? () => {
                      const updated = activeAgents.filter((_, i) => i !== idx)
                      onAgentsChange(updated)
                      if (activeSessionRef.current) {
                        saveAgentPersonas(activeSessionRef.current.id, agentConfigsToPersonas(updated))
                          .catch(err => console.error('[App] saveAgentPersonas error:', err))
                      }
                    } : undefined}
                  />
                </div>
              )
            })}
            <div className="header-avatar-wrap" title="Tambo - AI assistant (/ or @Tambo)">
              <BlobAvatar name="Tambo" size={18} color="#a78bfa" />
            </div>
            {activeAgents.length < 4 && (
              <button type="button"
                className="header-add-agent"
                onClick={onToggleConfigurator}
                title="Add agent"
                aria-label="Add agent"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
      {showConfigurator && (
        <div className="configurator-panel">
          <AgentConfigurator
            agents={activeAgents.map(a => {
              const preset = AGENT_DESCRIPTIONS[a.name]
              return {
                name: a.name,
                description: preset || a.persona.split('.')[0].replace(/^You are \w+, /, ''),
                persona: a.persona,
                owner: a.owner,
                color: a.color,
              }
            })}
            onChange={(configs) => {
              const updated = configs.map(c => ({
                name: c.name,
                persona: c.persona,
                owner: c.owner,
                color: c.color,
              }))
              onAgentsChange(updated)
              if (activeSessionRef.current) {
                saveAgentPersonas(activeSessionRef.current.id, agentConfigsToPersonas(updated))
                  .catch(err => console.error('[App] saveAgentPersonas error:', err))
              }
            }}
          />
        </div>
      )}
    </>
  )
}
