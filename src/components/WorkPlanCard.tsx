import { useState, memo } from 'react'
import type { AgentTask } from '../types'

type TaskTemplate = Pick<AgentTask, 'title' | 'assignedAgents' | 'sectionAnchor' | 'order'>

export const WorkPlanCard = memo(({ presetTitle, tasks: initialTasks, onStart, onCancel }: {
  presetTitle: string
  tasks: TaskTemplate[]
  onStart: (tasks: TaskTemplate[]) => void
  onCancel: () => void
}) => {
  const [tasks, setTasks] = useState(initialTasks)

  const removeTask = (idx: number) => {
    setTasks(prev => prev.filter((_, i) => i !== idx).map((t, i) => ({ ...t, order: i + 1 })))
  }

  return (
    <div className="work-plan-overlay">
      <div className="work-plan-card">
        <div className="work-plan-header">
          <span className="work-plan-title">Work Plan</span>
          <span className="work-plan-meta">Auto-generated for {presetTitle}</span>
        </div>
        <div className="work-plan-list">
          {tasks.map((t, i) => (
            <div key={i} className="work-plan-row">
              <span className="work-plan-num">{i + 1}</span>
              <span className="work-plan-circle" />
              <span className="work-plan-text">{t.title}</span>
              <span className="work-plan-agents">
                {t.assignedAgents.map(a => (
                  <span key={a} className="task-card-agent-dot" data-agent={a.toLowerCase()} />
                ))}
                <span className="work-plan-agent-names">{t.assignedAgents.join(', ')}</span>
              </span>
              <button className="work-plan-remove" onClick={() => removeTask(i)} title="Remove task">&times;</button>
            </div>
          ))}
        </div>
        <div className="work-plan-footer">
          <button className="work-plan-btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="work-plan-btn-primary"
            onClick={() => onStart(tasks)}
            disabled={tasks.length === 0}
          >Start writing</button>
        </div>
      </div>
    </div>
  )
})
