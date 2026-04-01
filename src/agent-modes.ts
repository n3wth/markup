import type { SessionPhase } from './phase-machine'

export interface AgentMode {
  label: string
  promptModifier: string
  allowedActions: string[]
}

export const AGENT_MODES: Record<string, Record<SessionPhase, AgentMode>> = {
  Aiden: {
    discovery: {
      label: 'Tech Feasibility',
      promptModifier: 'Take initiative on technical direction. Propose architecture, identify key constraints, and draft initial technical framing. If you need input, pair the question with a concrete suggestion.',
      allowedActions: ['chat', 'ask', 'search', 'insert', 'replace', 'plan'],
    },
    planning: {
      label: 'Architect',
      promptModifier: 'Create outlines and architecture proposals. Define component boundaries, data flow, API contracts. Take initiative on drafting technical sections, but stay responsive to user direction.',
      allowedActions: ['chat', 'ask', 'plan', 'search', 'propose', 'insert', 'replace'],
    },
    drafting: {
      label: 'Builder',
      promptModifier: 'Write implementation details. Specific protocols, data schemas, code-level decisions. Fill in technical sections with concrete content.',
      allowedActions: ['insert', 'replace', 'read', 'chat', 'search', 'delete'],
    },
    review: {
      label: 'Technical Reviewer',
      promptModifier: 'Review for technical accuracy. Check numbers, verify claims, identify missing error cases. Challenge vague technical language.',
      allowedActions: ['read', 'replace', 'chat', 'search'],
    },
  },
  Nova: {
    discovery: {
      label: 'User Researcher',
      promptModifier: 'Lead with user perspective. Draft user stories, sketch personas, and frame the problem from the customer\'s point of view. Propose the target audience and their core needs — ask for confirmation rather than asking from scratch.',
      allowedActions: ['chat', 'ask', 'search', 'insert', 'replace', 'plan'],
    },
    planning: {
      label: 'Product Strategist',
      promptModifier: 'Frame the product strategy. Define user stories, prioritize features, identify risks and assumptions. Take initiative on writing the product narrative — outline and draft, not just plan.',
      allowedActions: ['chat', 'ask', 'plan', 'search', 'propose', 'insert', 'replace'],
    },
    drafting: {
      label: 'Narrative Writer',
      promptModifier: 'Write compelling product narratives. User stories, positioning, value propositions. Focus on clarity and persuasiveness.',
      allowedActions: ['insert', 'replace', 'read', 'chat', 'search', 'delete'],
    },
    review: {
      label: 'Impact Assessor',
      promptModifier: 'Assess user impact and product-market fit. Challenge assumptions, verify metrics are measurable, ensure user stories are complete.',
      allowedActions: ['read', 'replace', 'chat', 'search'],
    },
  },
  Lex: {
    discovery: {
      label: 'Regulatory Scoper',
      promptModifier: 'Proactively flag regulatory and compliance considerations. Draft initial risk areas and compliance requirements based on what you can infer. Pair any questions with a concrete compliance suggestion.',
      allowedActions: ['chat', 'ask', 'search', 'insert', 'replace', 'plan'],
    },
    planning: {
      label: 'Compliance Mapper',
      promptModifier: 'Map compliance requirements to document sections. Draft initial legal language and disclaimers. Flag potential liability issues with concrete recommendations.',
      allowedActions: ['chat', 'ask', 'plan', 'search', 'propose', 'insert', 'replace'],
    },
    drafting: {
      label: 'Legal Drafter',
      promptModifier: 'Draft precise legal and compliance language. Terms, disclaimers, privacy considerations. Be specific about obligations and limitations.',
      allowedActions: ['insert', 'replace', 'read', 'chat', 'search', 'delete'],
    },
    review: {
      label: 'Risk Reviewer',
      promptModifier: 'Review for legal risk and compliance gaps. Check claims for liability exposure, verify regulatory adherence, flag ambiguous commitments.',
      allowedActions: ['read', 'replace', 'chat', 'search'],
    },
  },
  Mira: {
    discovery: {
      label: 'UX Researcher',
      promptModifier: 'Lead with design thinking. Sketch initial user flows, propose interaction patterns, and frame the UX direction. Draft early design considerations rather than just asking about them.',
      allowedActions: ['chat', 'ask', 'search', 'insert', 'replace', 'plan'],
    },
    planning: {
      label: 'Information Architect',
      promptModifier: 'Design the information architecture. Define content hierarchy, navigation patterns. Start drafting UX specifications and user flow descriptions.',
      allowedActions: ['chat', 'ask', 'plan', 'search', 'propose', 'insert', 'replace'],
    },
    drafting: {
      label: 'Design Writer',
      promptModifier: 'Write about design decisions, UX flows, and visual specifications. Focus on interaction details and accessibility considerations.',
      allowedActions: ['insert', 'replace', 'read', 'chat', 'search', 'delete'],
    },
    review: {
      label: 'Usability Reviewer',
      promptModifier: 'Review for usability and accessibility. Check that flows are complete, interactions are intuitive, and accessibility requirements are met.',
      allowedActions: ['read', 'replace', 'chat', 'search'],
    },
  },
}

const DEFAULT_MODE: AgentMode = {
  label: 'Collaborator',
  promptModifier: 'Collaborate on the document. Take initiative — suggest improvements, contribute content, and drive the work forward.',
  allowedActions: ['chat', 'ask', 'search', 'read', 'insert', 'replace', 'plan'],
}

export function getAgentMode(agentName: string, phase: SessionPhase): AgentMode {
  return AGENT_MODES[agentName]?.[phase] ?? DEFAULT_MODE
}
