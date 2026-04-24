import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'

const MAX_PROMPT_LENGTH = 200_000

const requestBodySchema = z.object({
  prompt: z.string().min(1).max(MAX_PROMPT_LENGTH),
})

export const maxDuration = 120

// Extract JSON from response text, handling markdown code fences
function extractJSON(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  try { return JSON.parse(trimmed) } catch { /* continue */ }

  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()) } catch { /* continue */ }
  }

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

  // Base URL: client header > env var > default localhost (dev only)
  const ollamaUrl = (req.headers['x-ollama-url'] as string)
    || process.env.OLLAMA_BASE_URL
    || 'http://localhost:11434'

  const model = (req.headers['x-ollama-model'] as string)
    || process.env.OLLAMA_MODEL
    || 'llama3.2'

  const parsed = requestBodySchema.safeParse(req.body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return res.status(400).json({ error: `Invalid request: ${issue.path.join('.') || '(body)'}: ${issue.message}` })
  }

  const { prompt } = parsed.data
  const agentName = req.headers['x-agent-name'] as string | undefined

  const jsonPrompt = `${prompt}

RESPONSE FORMAT: Return ONLY a single JSON object (no markdown, no explanation). The JSON must include:
- "type": one of "insert", "replace", "read", "chat", "search", "rename", "delete", "propose", "plan", "ask", "image"
- "thought": max 4 words summarizing your action
- "reasoning": array of 2-3 short strings
- For "insert": "position" (REQUIRED — use "after:S1", "after:S2" etc. matching section refs, or "end"), "content" (THE ACTUAL TEXT TO ADD), "chatBefore" (brief note)
- For "replace": "searchText", "replaceWith", "chatBefore"
- For "chat": "chatMessage"
- For "search": "query", "shouldContinue": true
- "shouldContinue": boolean (usually false)

CRITICAL: For "insert", the "content" field MUST contain the full document text you want to add.`

  try {
    const ollamaRes = await fetch(`${ollamaUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: jsonPrompt }],
        temperature: 0.7,
        stream: false,
      }),
    })

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text().catch(() => '')
      console.error('[ollama-proxy] upstream error:', ollamaRes.status, errText.slice(0, 200))
      return res.status(ollamaRes.status).json({
        error: `Ollama error ${ollamaRes.status}`,
        detail: errText.slice(0, 200),
      })
    }

    const ollamaData = await ollamaRes.json() as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number, completion_tokens?: number }
    }

    const rawText = ollamaData.choices?.[0]?.message?.content ?? ''
    if (!rawText) {
      return res.status(500).json({ error: 'Empty response from Ollama' })
    }

    const action = extractJSON(rawText)
    if (!action || !action.type) {
      console.error('[ollama-proxy] failed to parse JSON:', rawText.slice(0, 500))
      return res.status(500).json({ error: 'Failed to parse action JSON from model response' })
    }

    // Recovery: cross-copy between content and afterText
    if (action.type === 'insert' && !action.content && action.afterText) {
      action.content = action.afterText
    }

    console.log('[ollama-proxy]', agentName, action.type, { model })

    return res.status(200).json({
      action,
      usage: {
        input: ollamaData.usage?.prompt_tokens ?? 0,
        output: ollamaData.usage?.completion_tokens ?? 0,
      },
    })
  } catch (err) {
    console.error('[ollama-proxy] request failed:', err)
    const errMsg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({
      error: 'Proxy request failed',
      code: 'PROXY_ERROR',
      detail: errMsg,
    })
  }
}
