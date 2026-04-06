import { memo } from 'react'
import type { AgentTask } from '../types'

/** Summary card shown in chat when all tasks are complete */
export const TaskSummary = memo(({ tasks, startTime }: {
  tasks: AgentTask[]
  startTime?: string
}) => {
  const complete = tasks.filter(t => t.status === 'complete')
  if (complete.length === 0 || complete.length < tasks.length) return null

  // Agent contribution counts
  const agentCounts: Record<string, number> = {}
  for (const t of complete) {
    for (const a of t.assignedAgents) {
      agentCounts[a] = (agentCounts[a] || 0) + 1
    }
  }
  const maxCount = Math.max(...Object.values(agentCounts), 1)

  const elapsed = startTime
    ? Math.round((Date.now() - new Date(startTime).getTime()) / 60000)
    : null

  return (
    <div className="task-summary">
      <div className="task-summary-title">All tasks complete</div>
      <div className="task-summary-meta">
        {complete.length} tasks across {Object.keys(agentCounts).length} agents
        {elapsed !== null && ` in ${elapsed}m`}
      </div>
      <div className="task-summary-agents">
        {Object.entries(agentCounts).map(([name, count]) => (
          <div key={name} className="task-summary-agent-row">
            <span className="task-card-agent-dot" data-agent={name.toLowerCase()} />
            <span className="task-summary-agent-name">{name}</span>
            <span className="task-summary-agent-count">{count} task{count !== 1 ? 's' : ''}</span>
            <div className="task-summary-bar">
              <div className="task-summary-bar-fill" data-agent={name.toLowerCase()} style={{ width: `${(count / maxCount) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
