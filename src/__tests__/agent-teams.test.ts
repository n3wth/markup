import { describe, it, expect } from 'vitest'
import { TEAM_PRESETS, resolveTeam, getTeam } from '../lib/agent-teams'
import { AGENT_PRESETS } from '../lib/agent-presets'

describe('agent-teams', () => {
  it('all team members resolve to a known preset', () => {
    const presetNames = new Set(AGENT_PRESETS.map(p => p.name))
    for (const team of TEAM_PRESETS) {
      for (const member of team.memberPresetNames) {
        expect(presetNames.has(member)).toBe(true)
      }
    }
  })

  it('resolveTeam returns agents with team context prepended', () => {
    const agents = resolveTeam('launch-review')
    expect(agents).not.toBeNull()
    expect(agents!.length).toBe(3)
    const team = getTeam('launch-review')!
    for (const agent of agents!) {
      expect(agent.persona.startsWith(team.teamContext)).toBe(true)
    }
  })

  it('resolveTeam returns null for unknown id', () => {
    expect(resolveTeam('nonexistent')).toBeNull()
  })

  it('teams are distinct', () => {
    const ids = TEAM_PRESETS.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('getTeam returns the matching team', () => {
    const team = getTeam('full-review')
    expect(team?.memberPresetNames.length).toBe(4)
  })
})
