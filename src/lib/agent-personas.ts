import type { AgentConfig } from '../types'

export function agentConfigsToPersonas(agents: AgentConfig[]) {
  return agents.map(a => ({
    name: a.name,
    description: a.persona.split('.')[0].replace(/^You are \w+, /, ''),
    system_prompt: a.persona,
    color: a.color,
    owner: a.owner,
    model: 'gemini-3-flash',
    sort_order: 0,
  }))
}
