import type { VercelRequest, VercelResponse } from '@vercel/node'

export const maxDuration = 60

/** Planned Wave 3 tools; each call returns a stub until W3-T003..T006 land */
const STUB_TOOLS = [
  {
    name: 'doc.read',
    description: 'Read current document content as Markdown (stub)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'doc.edit',
    description: 'Apply a Tiptap-compatible edit (stub)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'doc.comment',
    description: 'Add a comment to the document (stub)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'session.list',
    description: "List the user's sessions in a project (stub)",
    inputSchema: { type: 'object', properties: {} },
  },
] as const

type JsonRpcRequest = {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

function jsonRpcError(
  id: string | number | null | undefined,
  code: number,
  message: string,
) {
  return {
    jsonrpc: '2.0' as const,
    id: id ?? null,
    error: { code, message },
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function parseBody(req: VercelRequest): unknown {
  const raw = req.body
  if (raw === undefined || raw === null) return undefined
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as unknown
    } catch {
      return undefined
    }
  }
  return raw
}

function handleOne(message: unknown): unknown | null {
  if (!isRecord(message)) {
    return jsonRpcError(null, -32600, 'Invalid Request')
  }

  const { id, method } = message as JsonRpcRequest
  const isNotification = id === undefined

  if (typeof method !== 'string') {
    return jsonRpcError(
      isNotification ? null : id ?? null,
      -32600,
      'Invalid Request',
    )
  }

  if (isNotification) {
    if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
      return null
    }
    return null
  }

  const params = isRecord(message.params) ? message.params : {}

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'markup-mcp', version: '0.0.0' },
        },
      }
    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: [...STUB_TOOLS] },
      }
    case 'tools/call': {
      const name = typeof params.name === 'string' ? params.name : ''
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'not implemented', tool: name }),
            },
          ],
          isError: true,
        },
      }
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} }
    default:
      return jsonRpcError(id ?? null, -32601, `Method not found: ${method}`)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res
      .status(405)
      .json(jsonRpcError(null, -32600, 'Method not allowed — use POST for MCP JSON-RPC'))
  }

  const parsed = parseBody(req)
  if (parsed === undefined) {
    return res.status(400).json(jsonRpcError(null, -32700, 'Parse error — expected JSON body'))
  }

  if (Array.isArray(parsed)) {
    const out = parsed.map((m) => handleOne(m)).filter((x) => x !== null)
    return res.status(200).json(out)
  }

  const single = handleOne(parsed)
  if (single === null) {
    return res.status(202).end()
  }

  return res.status(200).json(single)
}
