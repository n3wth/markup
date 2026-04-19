import path from 'path'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { agentActionSchema } from './src/agent-schema'
import tailwindcss from "@tailwindcss/vite";


const IMAGE_MODEL = 'gemini-3.1-flash-image-preview'
const IMAGE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const geminiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY

  return {
    plugins: [
      tailwindcss(), react(),
      {
        name: 'api-dev-middleware',
        configureServer(server) {
          // Score endpoint: no-op in dev (scores are optional)
          server.middlewares.use('/api/score', (_req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true, skipped: true, reason: 'dev mode' }))
          })

          server.middlewares.use('/api/gemini', async (req, res, next) => {
            if (req.method !== 'POST') { next(); return }

            const clientKey = req.headers['x-gemini-key'] as string | undefined
            const apiKey = geminiKey || clientKey
            if (!apiKey) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'No API key' }))
              return
            }

            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            let prompt: string
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString())
              prompt = body.prompt
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Invalid JSON body' }))
              return
            }

            if (!prompt) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Missing prompt' }))
              return
            }

            try {
              const google = createGoogleGenerativeAI({ apiKey })
              const result = await generateObject({
                model: google('gemini-2.5-flash'),
                schema: agentActionSchema,
                prompt,
                temperature: 0.7,
                maxRetries: 3,
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
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({
                action: result.object,
                usage: {
                  input: result.usage.inputTokens ?? 0,
                  output: result.usage.outputTokens ?? 0,
                },
              }))
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err)
              const status = errMsg.includes('429') ? 429 : 500
              res.writeHead(status, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: errMsg, code: status === 429 ? 'RATE_LIMIT' : 'PROXY_ERROR', status }))
            }
          })

          server.middlewares.use('/api/gemini-image', async (req, res) => {
            if (req.method !== 'POST') {
              res.writeHead(405, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }

            const clientKey = req.headers['x-gemini-key'] as string | undefined
            const apiKey = geminiKey || clientKey
            if (!apiKey) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'No API key' }))
              return
            }

            // Read request body
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            let prompt: string
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString())
              prompt = body.prompt
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Invalid JSON body' }))
              return
            }

            try {
              const apiRes = await fetch(`${IMAGE_API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    temperature: 0.7,
                  },
                  safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
                  ],
                }),
              })

              const data = await apiRes.json() as {
                error?: { message?: string; code?: number }
                candidates?: Array<{
                  content?: { parts?: Array<{ inlineData?: { data: string; mimeType?: string }; text?: string }> }
                }>
              }

              if (!apiRes.ok) {
                res.writeHead(apiRes.status, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({
                  error: data?.error?.message || 'API error',
                  code: data?.error?.code || apiRes.status,
                  status: apiRes.status,
                }))
                return
              }

              const parts = data?.candidates?.[0]?.content?.parts || []
              let imageData: string | null = null
              let mimeType = 'image/png'
              let caption: string | undefined

              for (const part of parts) {
                if (part.inlineData) {
                  imageData = part.inlineData.data
                  mimeType = part.inlineData.mimeType || 'image/png'
                } else if (part.text) {
                  caption = part.text.trim()
                }
              }

              if (!imageData) {
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'No image data in response' }))
                return
              }

              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ imageData, mimeType, caption }))
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Proxy request failed', detail: String(err) }))
            }
          })
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // Bind on all interfaces so IPv4 (127.0.0.1), port forwarding, and remote preview work
      host: true,
      port: 5173,
      strictPort: true,
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // Tambo re-exports Tiptap types/runtime and vice-versa, creating a
          // circular chunk graph when split across manual chunks. The prior
          // config produced:
          //   "Circular chunk: vendor-tiptap -> vendor-tambo -> vendor-tiptap"
          // which at runtime surfaced as a TypeError when one chunk's module
          // init ran against an uninitialized React namespace export from
          // the other (e.g. "Cannot set properties of undefined (setting
          // 'Activity')"). Merge the two chunks into one to eliminate the
          // cycle. The combined chunk is still lazily requested on first use.
          manualChunks: {
            'vendor-tiptap-tambo': [
              '@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder',
              '@tambo-ai/react', '@tambo-ai/react-ui-base', '@tambo-ai/typescript-sdk',
            ],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-shaders': ['@paper-design/shaders-react'],
            'vendor-posthog': ['posthog-js'],
            'vendor-framer': ['framer-motion'],
            'vendor-radix': ['@radix-ui/react-dropdown-menu', '@radix-ui/react-popover', '@radix-ui/react-slot', 'radix-ui'],
            'vendor-markdown': ['streamdown', 'highlight.js', 'dompurify'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['src/__tests__/**/*.test.ts'],
      exclude: ['**/.claude/**', '**/.worktrees/**'],
    },
  }
})
