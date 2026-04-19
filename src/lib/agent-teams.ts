import type { AgentConfig } from '../types'
import { AGENT_PRESETS } from './agent-presets'

/**
 * An \`AgentTeam\` is a named, reusable group of agents with a shared
 * team-level context. Unlike the \`HomeDashboard\` starters (which pair a
 * team with a specific doc template), teams are template-agnostic: you
 * can run the "Launch Review" team against a PRD, a tech spec, or a
 * blank canvas.
 *
 * The \`teamContext\` string is prepended to each agent's persona when
 * the team is active, so agents know they're collaborating under a
 * shared mission rather than four parallel individuals. This is the
 * seam where the multi-entity brainstorm's "shared stance" ideas
 * eventually land.
 *
 * Team membership is expressed by preset name rather than full
 * \`AgentConfig\` to keep the module declarative — the resolver fills in
 * persona/color from \`AGENT_PRESETS\` at runtime so a future edit to an
 * agent persona flows through every team automatically.
 */
export interface AgentTeam {
  id: string
  name: string
  description: string
  memberPresetNames: string[]
  teamContext: string
}

export const TEAM_PRESETS: AgentTeam[] = [
  {
    id: 'launch-review',
    name: 'Launch Review',
    description: 'Ship-readiness sweep: scope, risk, UX polish.',
    memberPresetNames: ['Aiden', 'Nova', 'Mira'],
    teamContext:
      'You are part of the Launch Review team. Your collective goal is to make the document ship-ready in the next 72 hours. Prioritize concrete gaps and unknowns over theoretical concerns. Defer to your teammates on their domains: architecture (Aiden), user and go-to-market (Nova), visual and UX (Mira).',
  },
  {
    id: 'compliance-review',
    name: 'Compliance Review',
    description: 'Legal, privacy, and regulatory sweep before external share.',
    memberPresetNames: ['Lex', 'Aiden'],
    teamContext:
      'You are part of the Compliance Review team. Your collective goal is to find legal, privacy, and regulatory risks before this document is shared externally. Lex leads; Aiden supports by flagging technical decisions that create compliance obligations (data retention, PII handling, audit surfaces).',
  },
  {
    id: 'design-crit',
    name: 'Design Crit',
    description: 'Product and design critique from user-first perspectives.',
    memberPresetNames: ['Mira', 'Nova'],
    teamContext:
      'You are part of the Design Crit team. Your collective goal is to challenge this document from the user\'s perspective. Mira focuses on interaction and visual hierarchy; Nova focuses on behavioral psychology and adoption. Disagree with each other when your lenses genuinely conflict — don\'t harmonize for the sake of harmony.',
  },
  {
    id: 'architecture-review',
    name: 'Architecture Review',
    description: 'Systems, APIs, failure modes, and scalability.',
    memberPresetNames: ['Aiden', 'Lex'],
    teamContext:
      'You are part of the Architecture Review team. Your collective goal is to stress-test the technical design. Aiden owns system boundaries, data flow, and failure modes. Lex owns regulatory and contractual constraints that shape the architecture (residency, retention, auditability).',
  },
  {
    id: 'full-review',
    name: 'Full Review',
    description: 'All four perspectives — the board meeting.',
    memberPresetNames: ['Aiden', 'Nova', 'Lex', 'Mira'],
    teamContext:
      'You are part of the Full Review team — all four disciplines at the table. Your collective goal is a complete, cross-functional review. Stay in your lane: Aiden for architecture, Nova for product, Lex for legal, Mira for design. When two of you overlap, defer to the owner of that domain.',
  },
]

/**
 * Resolve a team preset into concrete \`AgentConfig[]\` with team context
 * prepended to each persona. The resolver is pure: pass the same team
 * id, get the same agents back.
 */
export function resolveTeam(teamId: string): AgentConfig[] | null {
  const team = TEAM_PRESETS.find(t => t.id === teamId)
  if (!team) return null
  return team.memberPresetNames
    .map(name => {
      const preset = AGENT_PRESETS.find(p => p.name === name)
      if (!preset) return null
      return {
        name: preset.name,
        persona: `${team.teamContext}\n\n${preset.persona}`,
        owner: preset.owner,
        color: preset.color,
      }
    })
    .filter((a): a is AgentConfig => a !== null)
}

/** Look up a team by id. */
export function getTeam(teamId: string): AgentTeam | undefined {
  return TEAM_PRESETS.find(t => t.id === teamId)
}
