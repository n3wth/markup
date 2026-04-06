import { memo } from 'react'
import type { AgentTask, TaskEvent } from '../types'

/** Inline task event card rendered in the chat stream */
export const TaskCard = memo(({ event, onAdd, onDismiss }: {
  event: TaskEvent
  onAdd?: (task: Pick<AgentTask, 'title' | 'assignedAgents' | 'sectionAnchor'>) => void
  onDismiss?: () => void
}) => {
  if (event.type === 'completed') {
    return (
      <div className="task-card task-card-complete">
        <span className="task-card-check">&#x2713;</span>
        <span className="task-card-complete-label">Task completed</span>
        <span className="task-card-complete-title">{event.title}</span>
      </div>
    )
  }

  if (event.type === 'proposed') {
    return (
      <div className="task-card task-card-proposed">
        <div className="task-card-badge">Proposed task</div>
        <div className="task-card-title">{event.task.title}</div>
        {event.rationale && (
          <div className="task-card-rationale">{event.rationale}</div>
        )}
        <div className="task-card-agents">
          {event.task.assignedAgents.map(a => (
            <span key={a} className="task-card-agent-dot" data-agent={a.toLowerCase()} />
          ))}
          <span className="task-card-agent-names">{event.task.assignedAgents.join(' + ')}</span>
        </div>
        <div className="task-card-actions">
          <button className="task-card-btn task-card-btn-primary" onClick={() => onAdd?.(event.task)}>Add to plan</button>
          <button className="task-card-btn task-card-btn-ghost" onClick={onDismiss}>Dismiss</button>
        </div>
      </div>
    )
  }

  if (event.type === 'extracted') {
    return (
      <div className="task-card task-card-extracted">
        <div className="task-card-row">
          <span className="task-card-circle" />
          <span className="task-card-title">{event.task.title}</span>
        </div>
        <div className="task-card-agents">
          {event.task.assignedAgents.map(a => (
            <span key={a} className="task-card-agent-dot" data-agent={a.toLowerCase()} />
          ))}
          <span className="task-card-agent-names">{event.task.assignedAgents.join(' + ')}</span>
        </div>
        <div className="task-card-actions">
          <button className="task-card-btn task-card-btn-primary" onClick={() => onAdd?.(event.task)}>Add task</button>
          <button className="task-card-btn task-card-btn-ghost" onClick={onDismiss}>Ignore</button>
        </div>
      </div>
    )
  }

  if (event.type === 'plan') {
    return (
      <div className="task-card task-card-plan">
        <div className="task-card-plan-header">
          <span className="task-card-plan-title">Work Plan</span>
          <span className="task-card-plan-meta">{event.tasks.length} tasks</span>
        </div>
        {event.tasks.map((t, i) => (
          <div key={i} className="task-card-plan-row">
            <span className="task-card-plan-num">{i + 1}</span>
            <span className="task-card-circle" />
            <span className="task-card-plan-text">{t.title}</span>
            <span className="task-card-agents-inline">
              {t.assignedAgents.map(a => (
                <span key={a} className="task-card-agent-dot" data-agent={a.toLowerCase()} />
              ))}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return null
})
