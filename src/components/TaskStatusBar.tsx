import { memo } from 'react'
import type { AgentTask, AgentState } from '../types'

/** Compact status bar showing active tasks and overall progress above the editor */
export const TaskStatusBar = memo(({ tasks, agentStates }: {
  tasks: AgentTask[]
  agentStates: Record<string, AgentState>
}) => {
  if (tasks.length === 0) return null

  const complete = tasks.filter(t => t.status === 'complete').length
  const active = tasks.filter(t => t.status === 'active')
  const pending = tasks.filter(t => t.status === 'pending')
  const allDone = complete === tasks.length

  // Find which agents are currently working
  const workingAgents = active.flatMap(t =>
    t.assignedAgents.filter(a => {
      const state = agentStates[a]
      return state && state.status !== 'idle'
    })
  )

  return (
    <div className={`task-status-bar ${allDone ? 'task-status-done' : ''}`}>
      <div className="task-status-progress">
        <div className="task-status-bar-track">
          <div
            className="task-status-bar-fill"
            style={{ width: `${(complete / tasks.length) * 100}%` }}
          />
        </div>
        <span className="task-status-count">{complete}/{tasks.length}</span>
      </div>

      {active.length > 0 && (
        <div className="task-status-active">
          {active.map(t => (
            <div key={t.id} className="task-status-item">
              <span className="task-status-label">Working on:</span>
              <span className="task-status-title">{t.title}</span>
              <span className="task-status-agents">
                {t.assignedAgents.map(a => (
                  <span
                    key={a}
                    className={`task-status-agent-dot ${workingAgents.includes(a) ? 'task-status-agent-active' : ''}`}
                    data-agent={a.toLowerCase()}
                    title={a}
                  />
                ))}
              </span>
            </div>
          ))}
        </div>
      )}

      {active.length === 0 && !allDone && pending.length > 0 && (
        <div className="task-status-active">
          <span className="task-status-label">Next:</span>
          <span className="task-status-title">{pending[0].title}</span>
        </div>
      )}

      {allDone && (
        <div className="task-status-active">
          <span className="task-status-complete-text">All tasks complete</span>
        </div>
      )}
    </div>
  )
})
