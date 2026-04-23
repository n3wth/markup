import type { AgentTask } from './types'

type TaskTemplate = Pick<AgentTask, 'title' | 'assignedAgents' | 'sectionAnchor' | 'order'>

/** Default task plans for each starter preset. Agent names are resolved at
 *  runtime against the session's active agents. */
export const PRESET_TASKS: Record<string, TaskTemplate[]> = {
  'product-brief': [
    { title: 'Nail down who this is for', assignedAgents: ['Nova'], sectionAnchor: 'Target Audience', order: 1 },
    { title: 'Write the problem statement with real pain points', assignedAgents: ['Aiden', 'Nova'], sectionAnchor: 'Problem Statement', order: 2 },
    { title: 'Draft technical requirements and constraints', assignedAgents: ['Aiden'], sectionAnchor: 'Technical Constraints', order: 3 },
    { title: 'Map the competitive landscape', assignedAgents: ['Nova'], sectionAnchor: 'Competitive Landscape', order: 4 },
    { title: 'Final pass: clean it up', assignedAgents: ['Aiden', 'Nova'], order: 5 },
  ],
  'tech-spec': [
    { title: 'Set the system overview and goals', assignedAgents: ['Aiden'], sectionAnchor: 'Overview', order: 1 },
    { title: 'Draft architecture and component design', assignedAgents: ['Aiden'], sectionAnchor: 'Architecture', order: 2 },
    { title: 'Spec the API contracts and data models', assignedAgents: ['Aiden'], sectionAnchor: 'API Design', order: 3 },
    { title: 'Flag compliance and risk factors', assignedAgents: ['Lex'], sectionAnchor: 'Compliance', order: 4 },
    { title: 'Final pass: clean it up', assignedAgents: ['Aiden', 'Lex'], order: 5 },
  ],
  'design-review': [
    { title: 'Walk the user flow, note what feels off', assignedAgents: ['Mira'], sectionAnchor: 'User Flow', order: 1 },
    { title: 'Check visual hierarchy and accessibility', assignedAgents: ['Mira'], sectionAnchor: 'Visual Design', order: 2 },
    { title: 'Pressure-test product-market fit', assignedAgents: ['Nova'], sectionAnchor: 'Market Fit', order: 3 },
    { title: 'Write the recommendations — actionable ones', assignedAgents: ['Mira', 'Nova'], sectionAnchor: 'Recommendations', order: 4 },
  ],
  'meeting-notes': [
    { title: 'Capture the key discussion points', assignedAgents: ['Nova'], sectionAnchor: 'Discussion', order: 1 },
    { title: 'Pull out the decisions that got made', assignedAgents: ['Nova'], sectionAnchor: 'Decisions', order: 2 },
    { title: 'List action items with owners on them', assignedAgents: ['Aiden'], sectionAnchor: 'Action Items', order: 3 },
    { title: 'Round up the open questions', assignedAgents: ['Aiden', 'Nova'], sectionAnchor: 'Open Questions', order: 4 },
  ],
  'full-team': [
    { title: 'Set scope and objectives', assignedAgents: ['Nova'], order: 1 },
    { title: 'Draft the core content sections', assignedAgents: ['Aiden', 'Nova'], order: 2 },
    { title: 'Legal and compliance sweep', assignedAgents: ['Lex'], order: 3 },
    { title: 'Check UX and presentation', assignedAgents: ['Mira'], order: 4 },
    { title: 'Cross-team review — final polish', assignedAgents: ['Aiden', 'Nova', 'Lex', 'Mira'], order: 5 },
  ],
}

/** Resolve a preset's task templates against the actual active agents.
 *  If a named agent isn't in the session, reassign to the first active agent. */
export function resolvePresetTasks(
  presetId: string,
  activeAgentNames: string[],
): TaskTemplate[] {
  const templates = PRESET_TASKS[presetId]
  if (!templates || activeAgentNames.length === 0) return []

  return templates.map(t => ({
    ...t,
    assignedAgents: t.assignedAgents.map(name =>
      activeAgentNames.includes(name) ? name : activeAgentNames[0]
    ),
  }))
}
