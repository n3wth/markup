import { memo } from 'react'
import type { AgentTask } from '../types'

/** Compact dot-based progress indicator for the editor header */
export const TaskProgress = memo(({ tasks }: { tasks: AgentTask[] }) => {
  if (tasks.length === 0) return null

  const complete = tasks.filter(t => t.status === 'complete').length
  const allDone = complete === tasks.length

  return (
    <div className="task-progress">
      <div className="task-progress-dots">
        {tasks.map(t => (
          <span
            key={t.id}
            className={`task-progress-dot ${
              t.status === 'complete' ? 'task-dot-complete' :
              t.status === 'active' ? 'task-dot-active' :
              t.status === 'dismissed' ? 'task-dot-dismissed' :
              'task-dot-pending'
            }`}
            data-agent={t.status === 'active' ? t.assignedAgents[0]?.toLowerCase() : undefined}
            title={t.title}
          />
        ))}
      </div>
      <span className={`task-progress-count ${allDone ? 'task-progress-done' : ''}`}>
        {complete}/{tasks.length}
      </span>
    </div>
  )
})
