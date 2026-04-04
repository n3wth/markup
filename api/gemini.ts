import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { LangfuseSpanProcessor } from '@langfuse/otel'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { startActiveObservation, propagateAttributes } from '@langfuse/tracing'
import { agentActionSchema } from './agent-schema.js'

// Langfuse tracing setup (inline to avoid cross-file import issues in Vercel serverless)
// Trim env vars to handle trailing whitespace/newlines from Vercel env config
const langfuseSpanProcessor = new LangfuseSpanProcessor({
  publicKey: (process.env.LANGFUSE_PUBLIC_KEY || '').trim(),
  secretKey: (process.env.LANGFUSE_SECRET_KEY || '').trim(),
  baseUrl: (process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com').trim(),
})
const tracerProvider = new NodeTracerProvider({ spanProcessors: [langfuseSpanProcessor] })
tracerProvider.register()

const MODEL_ID = 'gemini-2.5-flash'

export const maxDuration = 60

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

        const result = await generateObject({
          model: google(MODEL_ID),
          schema: agentActionSchema,
          prompt,
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

        generation.update({
          output: result.object,
          usageDetails: {
            input: result.usage.inputTokens ?? 0,
            output: result.usage.outputTokens ?? 0,
            total: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
          },
          metadata: { agentName, sessionId, latencyMs },
        })

        return { action: result.object, usage: result.usage, latencyMs }
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

    // Recovery: if thought contains substantial text and content/afterText are empty,
    // Gemini likely put the document content in the wrong field
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
        thoughtLen: thought.length,
      })
    }

    return res.status(200).json({
      action,
      usage: {
        input: data.usage.inputTokens ?? 0,
        output: data.usage.outputTokens ?? 0,
      },
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
