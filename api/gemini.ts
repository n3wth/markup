import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { LangfuseSpanProcessor } from '@langfuse/otel'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { startActiveObservation, propagateAttributes } from '@langfuse/tracing'

// Langfuse tracing setup (inline to avoid cross-file import issues in Vercel serverless)
// Trim env vars to handle trailing whitespace/newlines from Vercel env config
const langfuseSpanProcessor = new LangfuseSpanProcessor({
  publicKey: (process.env.LANGFUSE_PUBLIC_KEY || '').trim(),
  secretKey: (process.env.LANGFUSE_SECRET_KEY || '').trim(),
  baseUrl: (process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com').trim(),
})
const tracerProvider = new NodeTracerProvider({ spanProcessors: [langfuseSpanProcessor] })
tracerProvider.register()

const MODEL_ID = 'gemini-3-flash-preview'

export const maxDuration = 60

// Extract JSON from response text, handling markdown code fences
function extractJSON(text: string): Record<string, unknown> | null {
  // Try direct parse first
  const trimmed = text.trim()
  try { return JSON.parse(trimmed) } catch { /* continue */ }

  // Try extracting from code fence
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()) } catch { /* continue */ }
  }

  // Try finding first { ... } block
  const braceStart = trimmed.indexOf('{')
  const braceEnd = trimmed.lastIndexOf('}')
  if (braceStart !== -1 && braceEnd > braceStart) {
    try { return JSON.parse(trimmed.slice(braceStart, braceEnd + 1)) } catch { /* continue */ }
  }

  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY || (req.headers['x-gemini-key'] as string)
  if (!apiKey) {
    return res.status(400).json({ error: 'No API key. Set GEMINI_API_KEY on server or provide your own in Settings.' })
  }

  const sessionId = req.headers['x-session-id'] as string | undefined
  const userId = req.headers['x-user-id'] as string | undefined
  const agentName = req.headers['x-agent-name'] as string | undefined

  const { prompt } = req.body || {}
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt in request body', code: 'BAD_REQUEST', status: 400 })
  }

  const google = createGoogleGenerativeAI({ apiKey })

  // Append JSON format instruction to the prompt
  const jsonPrompt = `${prompt}

RESPONSE FORMAT: Return ONLY a single JSON object (no markdown, no explanation). The JSON must include:
- "type": one of "insert", "replace", "read", "chat", "search", "rename", "delete", "propose", "plan", "ask", "image"
- "thought": max 4 words summarizing your action
- "reasoning": array of 2-3 short strings
- For "insert": "position" (e.g. "end", "after:SectionName"), "content" (THE ACTUAL PARAGRAPHS TO ADD - this is the most important field), "chatBefore" (brief note)
- For "replace": "searchText", "replaceWith", "chatBefore"
- For "chat": "chatMessage"
- For "search": "query", "shouldContinue": true
- "shouldContinue": boolean (usually false)

CRITICAL: For "insert", the "content" field MUST contain the full document text you want to add. Do NOT put document content in "thought" or "reasoning".`

  try {
    const data = await propagateAttributes(
      { sessionId, userId, traceName: agentName ? `${agentName}-generation` : 'gemini-generation' },
      () => startActiveObservation('gemini-generate', async (generation) => {
        const startMs = Date.now()

        generation.update({
          model: MODEL_ID,
          input: prompt,
          metadata: { agentName, sessionId },
        })

        const result = await generateText({
          model: google(MODEL_ID),
          prompt: jsonPrompt,
          temperature: 0.7,
          maxRetries: 1,
          providerOptions: {
            google: {
              safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
              ],
            },
          },
        })

        const latencyMs = Date.now() - startMs
        const action = extractJSON(result.text)

        if (!action || !action.type) {
          console.error('[gemini-proxy] Failed to parse JSON from response:', result.text.slice(0, 500))
          throw new Error('Failed to parse action JSON from model response')
        }

        generation.update({
          output: action,
          usageDetails: {
            input: result.usage.inputTokens ?? 0,
            output: result.usage.outputTokens ?? 0,
            total: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
          },
          metadata: { agentName, sessionId, latencyMs },
        })

        return { action, usage: result.usage, latencyMs }
      }, { asType: 'generation' }),
    )

    await langfuseSpanProcessor.forceFlush()

    const action = data.action as Record<string, unknown>

    // Recovery: cross-copy between content and afterText
    if (action.type === 'insert' && !action.content && action.afterText) {
      action.content = action.afterText
    }
    if (action.type === 'propose_edit' && action.editKind === 'insert' && !action.afterText && action.content) {
      action.afterText = action.content
    }

    // Recovery: if thought contains substantial text and content/afterText are empty
    const thought = typeof action.thought === 'string' ? action.thought : ''
    const hasDocContent = !!(action.content || action.afterText)
    if (!hasDocContent && thought.length > 100 && (action.type === 'insert' || action.type === 'propose_edit')) {
      console.log('[gemini-proxy] recovering content from thought field', { thoughtLen: thought.length })
      if (action.type === 'insert') {
        action.content = thought
      } else {
        action.afterText = thought
      }
      action.thought = thought.split(/\s+/).slice(0, 4).join(' ')
    }

    // Log for debugging
    if (action.type === 'insert' || action.type === 'propose_edit') {
      console.log('[gemini-proxy]', agentName, action.type, {
        hasContent: !!action.content,
        hasAfterText: !!action.afterText,
        contentLen: typeof action.content === 'string' ? action.content.length : 0,
        afterTextLen: typeof action.afterText === 'string' ? (action.afterText as string).length : 0,
      })
    }

    return res.status(200).json({
      action,
      usage: {
        input: data.usage.inputTokens ?? 0,
        output: data.usage.outputTokens ?? 0,
      },
      latencyMs: data.latencyMs,
    })
  } catch (err) {
    console.error('[gemini-proxy] Request failed:', err)

    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit')) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT',
        status: 429,
      })
    }

    return res.status(500).json({
      error: 'Proxy request failed',
      code: 'PROXY_ERROR',
      status: 500,
      detail: errMsg,
    })
  }
}
