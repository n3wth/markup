import { z } from 'zod'

const sourceSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  quote: z.string().optional(),
})

export const agentActionSchema = z.object({
  type: z.enum([
    'insert', 'replace', 'read', 'chat', 'search',
    'rename', 'delete', 'propose', 'plan', 'ask', 'image', 'propose_edit',
  ]),
  // Positioning and content — min(1) prevents empty-string actions
  position: z.string().optional(),
  content: z.string().min(1).optional().describe('The actual document text to insert. For type "insert", this MUST contain the full paragraphs/content to add. Do NOT put content in the thought field.'),
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
  thought: z.string().max(30).optional().describe('Max 4 words summarizing your action. NOT for document content.'),
  reasoning: z.array(z.string()).optional(),
  shouldContinue: z.boolean().optional(),
  editKind: z.enum(['insert', 'replace', 'delete']).optional(),
  editTarget: z.string().optional().describe('Target position, e.g. "after:SectionName" or "end"'),
  beforeText: z.string().min(1).optional().describe('Exact text from doc to replace or delete'),
  afterText: z.string().min(1).optional().describe('New content to insert or replace with. MUST contain the actual paragraphs/text to add to the document.'),
  editRationale: z.string().optional().describe('Brief explanation of why this edit improves the document'),
  sources: z.array(sourceSchema).optional(),
})

export type AgentActionFromSchema = z.infer<typeof agentActionSchema>
