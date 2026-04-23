import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentConfig, DocTemplate, Project, Session } from '../types'
import { AGENT_PRESETS } from '../lib/agent-presets'
import { TEAM_PRESETS, resolveTeam } from '../lib/agent-teams'
import { createProject, loadProjects } from '../lib/session-store'
import { groupSessionsByProject } from '../lib/project-tree'

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
    description: 'Pressure-test the user story, lock in the architecture.',
    template: 'prd',
    agents: [
      { name: 'Aiden', persona: AGENT_PRESETS[0].persona, owner: 'You', color: '#30d158' },
      { name: 'Nova', persona: AGENT_PRESETS[1].persona, owner: 'You', color: '#ff6961' },
    ],
  },
  {
    id: 'tech-spec',
    title: 'Technical Spec',
    description: 'System design, plus a compliance and risk read.',
    template: 'tech-spec',
    agents: [
      { name: 'Aiden', persona: AGENT_PRESETS[0].persona, owner: 'You', color: '#30d158' },
      { name: 'Lex', persona: AGENT_PRESETS[2].persona, owner: 'You', color: '#64d2ff' },
    ],
  },
  {
    id: 'design-review',
    title: 'Design Review',
    description: 'UX read plus a product-market fit check.',
    template: 'prd',
    agents: [
      { name: 'Mira', persona: AGENT_PRESETS[3].persona, owner: 'You', color: '#ffd60a' },
      { name: 'Nova', persona: AGENT_PRESETS[1].persona, owner: 'You', color: '#ff6961' },
    ],
  },
  {
    id: 'meeting-notes',
    title: 'Meeting Notes',
    description: 'Catch the decisions, pull out action items.',
    template: 'meeting-notes',
    agents: [
      { name: 'Nova', persona: AGENT_PRESETS[1].persona, owner: 'You', color: '#ff6961' },
      { name: 'Aiden', persona: AGENT_PRESETS[0].persona, owner: 'You', color: '#30d158' },
    ],
  },
  {
    id: 'full-team',
    title: 'Full Team',
    description: 'Engineering, product, legal, design — everyone in the doc.',
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
    description: 'Empty doc. Pick your agents, cook.',
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
  if (h < 12) return 'gm'
  if (h < 17) return 'Afternoon'
  return 'Evening'
}

const ALL_PROJECTS = '__all__'

export function HomeDashboard({ sessions, sessionsLoaded, onNewDoc, onSelectSession, onStarterPick }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>(ALL_PROJECTS)
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const [creatingError, setCreatingError] = useState<string | null>(null)
  const [creatingBusy, setCreatingBusy] = useState(false)
  const newProjectInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    loadProjects()
      .then(rows => { if (!cancelled) setProjects(rows.filter(p => !p.archived_at)) })
      .catch(() => { /* RLS or offline — show all-projects only */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (creatingProject) newProjectInputRef.current?.focus()
  }, [creatingProject])

  const visibleSessions = useMemo(() => {
    if (selectedProjectId === ALL_PROJECTS) return sessions
    return sessions.filter(s => s.project_id === selectedProjectId)
  }, [sessions, selectedProjectId])

  const projectGroups = useMemo(
    () => groupSessionsByProject(projects, sessions),
    [projects, sessions],
  )

  const continueSession = sessionsLoaded && visibleSessions.length > 0 && visibleSessions[0].title && visibleSessions[0].title !== 'Untitled'
    ? visibleSessions[0]
    : null

  async function handleCreateProject() {
    const title = newProjectTitle.trim()
    if (!title || creatingBusy) return
    setCreatingBusy(true)
    setCreatingError(null)
    try {
      const project = await createProject(title)
      setProjects(prev => [project, ...prev])
      setSelectedProjectId(project.id)
      setNewProjectTitle('')
      setCreatingProject(false)
    } catch (err) {
      setCreatingError(err instanceof Error ? err.message : 'Could not create project')
    } finally {
      setCreatingBusy(false)
    }
  }

  return (
    <div className="home-dashboard">
      <div className="home-center">
        <div className="home-glow" />
        <h2 className="home-heading">{getGreeting()}</h2>
        <p className="home-sub">What are we cooking up today?</p>

        {(projects.length > 0 || creatingProject) && (
          <div className="home-project-tabs" role="tablist" aria-label="Projects">
            <button
              type="button"
              role="tab"
              aria-selected={selectedProjectId === ALL_PROJECTS}
              className={`home-project-tab ${selectedProjectId === ALL_PROJECTS ? 'home-project-tab-active' : ''}`}
              onClick={() => setSelectedProjectId(ALL_PROJECTS)}
            >
              All
            </button>
            {projects.map(p => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={selectedProjectId === p.id}
                className={`home-project-tab ${selectedProjectId === p.id ? 'home-project-tab-active' : ''}`}
                onClick={() => setSelectedProjectId(p.id)}
              >
                {p.title}
              </button>
            ))}
            {creatingProject ? (
              <span className="home-project-new">
                <input
                  ref={newProjectInputRef}
                  className="home-project-new-input"
                  type="text"
                  placeholder="Project name"
                  value={newProjectTitle}
                  disabled={creatingBusy}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleCreateProject() }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setCreatingProject(false)
                      setNewProjectTitle('')
                      setCreatingError(null)
                    }
                  }}
                />
                {creatingError && <span className="home-project-new-error" role="alert">{creatingError}</span>}
              </span>
            ) : (
              <button
                type="button"
                className="home-project-tab home-project-new-btn"
                onClick={() => setCreatingProject(true)}
                aria-label="New project"
                title="New project"
              >
                +
              </button>
            )}
          </div>
        )}

        {projects.length === 0 && !creatingProject && (
          <div className="home-project-tabs">
            <button
              type="button"
              className="home-project-tab home-project-new-btn"
              onClick={() => setCreatingProject(true)}
            >
              + New project
            </button>
          </div>
        )}

        {sessionsLoaded && projects.length > 0 && selectedProjectId === ALL_PROJECTS && sessions.length > 0 && (
          <div className="home-project-sessions">
            {projectGroups.map(group => {
              if (group.sessions.length === 0) return null
              const heading = group.project?.title ?? 'Inbox'
              const key = group.project?.id ?? '__inbox__'
              return (
                <div key={key} className="home-project-group">
                  <div className="home-project-group-label">{heading}</div>
                  <ul className="home-project-session-list">
                    {group.sessions.slice(0, 5).map(s => (
                      <li key={s.id}>
                        <button type="button" className="home-project-session-btn" onClick={() => onSelectSession(s)}>
                          <span className="home-project-session-title">{s.title || 'Untitled'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}

        {selectedProjectId !== ALL_PROJECTS && sessionsLoaded && (
          <div className="home-project-sessions">
            {visibleSessions.length === 0 ? (
              <p className="home-project-empty">Nothing in this project yet.</p>
            ) : (
              <ul className="home-project-session-list">
                {visibleSessions.slice(0, 8).map(s => (
                  <li key={s.id}>
                    <button type="button" className="home-project-session-btn" onClick={() => onSelectSession(s)}>
                      <span className="home-project-session-title">{s.title || 'Untitled'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

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
              New doc
            </button>
          </div>
        )}

        {onStarterPick && (
          <div className="home-teams">
            <div className="home-teams-label">Or roll with a team</div>
            <div className="home-team-chips">
              {TEAM_PRESETS.map(team => {
                const members = team.memberPresetNames
                  .map(name => {
                    const color = AGENT_PRESETS.find(p => p.name === name)?.color
                    return color ? { name, color } : null
                  })
                  .filter((m): m is { name: string; color: string } => m !== null)
                if (members.length === 0) return null
                return (
                  <button
                    type="button"
                    key={team.id}
                    className="home-team-chip"
                    title={team.description}
                    onClick={() => {
                      const agents = resolveTeam(team.id)
                      if (!agents || agents.length === 0) return
                      onStarterPick({
                        id: team.id,
                        title: team.name,
                        template: 'blank',
                        agents,
                      })
                    }}
                  >
                    <span className="home-team-dots" aria-hidden="true">
                      {members.map(m => (
                        <span key={m.name} className="home-team-dot" style={{ background: m.color }} />
                      ))}
                    </span>
                    <span className="home-team-name">{team.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="home-shortcuts">
          <span className="home-shortcut"><kbd>&#8984;N</kbd> New</span>
          <span className="home-shortcut"><kbd>&#8984;K</kbd> Focus chat</span>
        </div>
      </div>
    </div>
  )
}
