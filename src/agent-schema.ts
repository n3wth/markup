import { z } from 'zod'

export const agentActionSchema = z.object({
  type: z.enum([
    'insert', 'replace', 'read', 'chat', 'search',
    'rename', 'delete', 'propose', 'plan', 'ask', 'image',
  ]),
  // Positioning and content — min(1) prevents empty-string actions
  position: z.string().optional(),
  content: z.string().min(1).optional(),
  searchText: z.string().min(1).optional(),
  replaceWith: z.string().min(1).optional(),
  highlightText: z.string().optional(),
  query: z.string().min(1).optional(),
  newTitle: z.string().min(1).optional(),
  deleteText: z.string().min(1).optional(),
  proposal: z.string().min(1).optional(),
  proposalType: z.enum(['create-doc', 'delete-doc', 'add-agent', 'remove-agent']).optional(),
  steps: z.array(z.string()).optional(),
  question: z.string().min(1).optional(),
  imagePrompt: z.string().min(1).optional(),
  imageCaption: z.string().optional(),
  // Chat and reasoning
  chatBefore: z.string().optional(),
  chatMessage: z.string().min(1).optional(),
  thought: z.string().optional(),
  reasoning: z.array(z.string()).optional(),
  shouldContinue: z.boolean().optional(),
})

export type AgentActionFromSchema = z.infer<typeof agentActionSchema>
