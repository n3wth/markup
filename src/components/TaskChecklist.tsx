import { memo, useState } from 'react'
import type { AgentTask } from '../types'

/** Compact collapsible task checklist shown at the top of the chat panel */
export const TaskChecklist = memo(({ tasks }: { tasks: AgentTask[] }) => {
  const [expanded, setExpanded] = useState(true)

  if (tasks.length === 0) return null

  const complete = tasks.filter(t => t.status === 'complete').length
  const allDone = complete === tasks.length

  return (
    <div className="task-checklist">
      <button className="task-checklist-header" onClick={() => setExpanded(!expanded)}>
        <span className="task-checklist-label">Tasks</span>
        <span className={`task-checklist-count ${allDone ? 'task-checklist-done' : ''}`}>
          {complete}/{tasks.length}
        </span>
        <span className={`task-checklist-chevron ${expanded ? 'task-checklist-expanded' : ''}`}>
          &#x25B8;
        </span>
      </button>
      {expanded && (
        <div className="task-checklist-list">
          {tasks.filter(t => t.status !== 'dismissed').map(t => (
            <div key={t.id} className={`task-checklist-row ${t.status === 'active' ? 'task-checklist-active' : ''}`}>
              {t.status === 'complete' ? (
                <span className="task-checklist-check">&#x2713;</span>
              ) : t.status === 'active' ? (
                <span className="task-checklist-circle task-checklist-circle-active" data-agent={t.assignedAgents[0]?.toLowerCase()} />
              ) : (
                <span className="task-checklist-circle" />
              )}
              <span className={`task-checklist-text ${t.status === 'complete' ? 'task-checklist-done-text' : ''}`}>
                {t.title}
              </span>
              {t.status !== 'complete' && t.assignedAgents.length > 0 && (
                <span className="task-checklist-agents">
                  {t.assignedAgents.map(a => (
                    <span key={a} className="task-card-agent-dot" data-agent={a.toLowerCase()} />
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
