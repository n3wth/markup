import posthog from 'posthog-js'

// PostHog is initialized by PostHogProvider in main.tsx.
// These helpers use the posthog singleton for tracking outside React components.

export function identify(userId: string, properties?: Record<string, unknown>) {
  if (!posthog.__loaded) return
  posthog.identify(userId, properties)
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!posthog.__loaded) return
  posthog.capture(event, properties)
}

// Typed event helpers
export const events = {
  sessionCreated: (template: string, agentCount: number) =>
    track('session_created', { template, agent_count: agentCount }),

  sessionOpened: (sessionId: string, template: string) =>
    track('session_opened', { session_id: sessionId, template }),

  messageSent: (sessionId: string, mentionedAgents: string[]) =>
    track('message_sent', { session_id: sessionId, mentioned_agents: mentionedAgents }),

  agentAction: (sessionId: string, agent: string, actionType: string, success: boolean) =>
    track('agent_action', { session_id: sessionId, agent, action_type: actionType, success }),

  agentError: (sessionId: string, agent: string, errorCode: string) =>
    track('agent_error', { session_id: sessionId, agent, error_code: errorCode }),

  planningPhaseCompleted: (sessionId: string, messageCount: number) =>
    track('planning_phase_completed', { session_id: sessionId, message_count: messageCount }),

  imageGenerated: (sessionId: string, agent: string, success: boolean) =>
    track('image_generated', { session_id: sessionId, agent, success }),

  templatePicked: (template: string, agents: string[]) =>
    track('template_picked', { template, agents }),

  agentConfigChanged: (agentCount: number, agents: string[]) =>
    track('agent_config_changed', { agent_count: agentCount, agents }),

  // Edit placement tracking
  editPositionResolved: (sessionId: string, agent: string, target: string, strategy: string, matched: boolean, matchedHeading?: string) =>
    track('edit_position_resolved', { session_id: sessionId, agent, target, strategy, matched, matched_heading: matchedHeading }),

  editPositionFallback: (sessionId: string, agent: string, targetHeading: string, availableHeadings: string[]) =>
    track('edit_position_fallback', { session_id: sessionId, agent, target_heading: targetHeading, available_headings: availableHeadings }),

  // Agent lifecycle
  agentActivated: (sessionId: string, agent: string, trigger: string) =>
    track('agent_activated', { session_id: sessionId, agent, trigger }),

  agentDeactivated: (sessionId: string, agent: string, reason: string) =>
    track('agent_deactivated', { session_id: sessionId, agent, reason }),

  // Orchestrator internals
  orchestratorTurn: (sessionId: string, agent: string, trigger: string, actionType: string, success: boolean, durationMs: number) =>
    track('orchestrator_turn', { session_id: sessionId, agent, trigger, action_type: actionType, success, duration_ms: durationMs }),

  orchestratorQueueDepth: (sessionId: string, depth: number, processingAgent: string | null) =>
    track('orchestrator_queue_depth', { session_id: sessionId, depth, processing_agent: processingAgent }),
}
