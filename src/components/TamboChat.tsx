import { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react'
import { useTambo, useTamboThreadInput } from '@tambo-ai/react'
import type { TamboComponentContent, TamboThreadMessage, TamboToolUseContent } from '@tambo-ai/react'
import { BlobAvatar } from '../blob-avatar'
import { ChatMessage } from './ChatMessage'
import { TaskChecklist } from './TaskChecklist'
import { ShapeAvatar } from './ShapeAvatar'
import DOMPurify from 'dompurify'
import type { Message, AgentState, AgentConfig, AgentTask } from '../types'

const SLASH_COMMANDS = ['/outline', '/analytics', '/suggestions', '/insights', '/research', '/ask', '/expand', '/summarize', '/tone', '/checklist', '/compare'] as const

interface ChatPanelProps {
  messages: Message[]
  activeAgents: AgentConfig[]
  getAgentState: (name: string) => AgentState
  userAvatarUrl?: string
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onSendSuggestion: (text: string) => void
  onApproveProposal: (id: string) => void
  onRejectProposal: (id: string) => void
  onAddTask?: (task: Pick<AgentTask, 'title' | 'assignedAgents' | 'sectionAnchor'>) => void
  tasks?: AgentTask[]
  chatWidth: number
}

type TimelineItem =
  | { kind: 'team'; msg: Message; seq: number }
  | { kind: 'tambo'; msg: TamboThreadMessage; seq: number }

// Stable ordering: assign a sequence number to each message id on first
// encounter. Because both arrays are append-only, the map grows monotonically
// and earlier entries keep their original position.
function buildSequenceMap(
  teamMsgs: Message[],
  tamboMsgs: TamboThreadMessage[],
  prev: Map<string, number>,
): Map<string, number> {
  let counter = prev.size
  const next = new Map(prev)
  for (const m of teamMsgs) {
    if (!next.has(m.id)) next.set(m.id, counter++)
  }
  for (const m of tamboMsgs) {
    if (!next.has(m.id)) next.set(m.id, counter++)
  }
  // Only return a new object when entries were actually added
  return next.size === prev.size ? prev : next
}

// Handle ArrowUp / ArrowDown / Escape for any autocomplete dropdown.
// Returns true if the key was consumed.
function handleAutocompleteNav(
  e: React.KeyboardEvent,
  count: number,
  setIndex: React.Dispatch<React.SetStateAction<number>>,
  dismiss: () => void,
): boolean {
  if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, count - 1)); return true }
  if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)); return true }
  if (e.key === 'Escape') { dismiss(); return true }
  return false
}

export function TamboChat({
  messages,
  activeAgents,
  getAgentState,
  userAvatarUrl,
  input,
  onInputChange,
  onSend,
  onSendSuggestion,
  onApproveProposal,
  onRejectProposal,
  onAddTask,
  tasks,
  chatWidth,
}: ChatPanelProps) {
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [chatVisibleCount, setChatVisibleCount] = useState(50)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [slashQuery, setSlashQuery] = useState<string | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const MENTION_NAMES = useMemo(() => [...activeAgents.map(a => a.name), 'Tambo'], [activeAgents])

  // Tambo hooks
  const { messages: tamboMessages, isStreaming } = useTambo()
  const { setValue: setTamboInput, submit: tamboSubmit, isPending } = useTamboThreadInput()

  // Stable sequence map for interleaving team + tambo messages chronologically.
  // Both arrays are append-only, so ordering by first-seen index is deterministic.
  const seqMap = useMemo(
    () => buildSequenceMap(messages, tamboMessages, new Map<string, number>()),
    [messages, tamboMessages],
  )

  // Auto-scroll on any new message
  const lastCount = useRef(0)
  useEffect(() => {
    const total = messages.length + tamboMessages.length
    if (total > lastCount.current) {
      lastCount.current = total
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, tamboMessages.length])

  // Keep scrolled to bottom during streaming
  useEffect(() => {
    if (!isStreaming && !isPending) return
    const interval = setInterval(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 300)
    return () => clearInterval(interval)
  }, [isStreaming, isPending])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value
    onInputChange(val)

    if (val.startsWith('/')) {
      setSlashQuery(val.toLowerCase())
      setSlashIndex(0)
      setMentionQuery(null)
      return
    }

    setSlashQuery(null)
    const atIdx = val.lastIndexOf('@')
    if (atIdx !== -1 && (atIdx === 0 || val[atIdx - 1] === ' ')) {
      const query = val.slice(atIdx + 1)
      if (!query.includes(' ')) {
        setMentionQuery(query)
        setMentionIndex(0)
        return
      }
    }
    setMentionQuery(null)
  }, [onInputChange])

  // Send a prompt to Tambo: set the input value, clear the UI, then submit
  // after React has flushed the state update.
  const sendToTambo = useCallback((text: string) => {
    setTamboInput(text)
    onInputChange('')
    setSlashQuery(null)
    // setTimeout lets React flush setTamboInput before we call submit
    setTimeout(() => { tamboSubmit().catch(err => console.warn('[Tambo] submit failed:', err)) }, 100)
  }, [setTamboInput, onInputChange, tamboSubmit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Slash command autocomplete
    if (slashQuery !== null) {
      const filtered = SLASH_COMMANDS.filter(c => c.startsWith(slashQuery))
      if (handleAutocompleteNav(e, filtered.length, setSlashIndex, () => setSlashQuery(null))) return
      if (e.key === 'Tab' && filtered.length > 0) {
        e.preventDefault()
        onInputChange(filtered[slashIndex] + ' ')
        setSlashQuery(null)
        return
      }
    }

    // @mention autocomplete
    if (mentionQuery !== null) {
      const filtered = MENTION_NAMES.filter(n => n.toLowerCase().startsWith(mentionQuery.toLowerCase()))
      if (handleAutocompleteNav(e, filtered.length, setMentionIndex, () => setMentionQuery(null))) return
      if (e.key === 'Tab' || (e.key === 'Enter' && filtered.length > 0)) {
        e.preventDefault()
        const pick = filtered[Math.min(mentionIndex, filtered.length - 1)] ?? filtered[0]
        if (pick) {
          onInputChange(input.slice(0, input.lastIndexOf('@')) + '@' + pick + ' ')
          setMentionQuery(null)
        }
        return
      }
    }

    if (e.key === 'Enter') {
      const text = input.trim()
      if (!text) return
      if (text.startsWith('/')) {
        e.preventDefault()
        const match = text.match(/^\/(\w+)\s*(.*)$/)
        sendToTambo(tamboPrompt(match?.[1] ?? '', match?.[2]?.trim() ?? ''))
      } else if (text.toLowerCase().includes('@tambo')) {
        e.preventDefault()
        sendToTambo(text)
      } else {
        onSend()
      }
    }
  }, [slashQuery, slashIndex, mentionQuery, mentionIndex, MENTION_NAMES, input, onInputChange, onSend, sendToTambo])

  // Build unified timeline sorted by sequence number
  const { visible, hiddenCount } = useMemo(() => {
    const filtered = messages.filter(m => !m.text.startsWith('Couldn\'t find that text'))
    const hidden = Math.max(0, filtered.length - chatVisibleCount)
    const vis = hidden > 0 ? filtered.slice(-chatVisibleCount) : filtered
    return { visible: vis, hiddenCount: hidden }
  }, [messages, chatVisibleCount])

  const tamboFiltered = useMemo(() => {
    const valid = tamboMessages.filter(m => m.content && (!Array.isArray(m.content) || m.content.length > 0))
    // Skip text-only messages when next assistant message has a component
    return valid.filter((m, i) => {
      if (m.role !== 'assistant' || !Array.isArray(m.content)) return true
      if (m.content.some(b => b.type === 'component')) return true
      const next = valid[i + 1]
      if (next?.role === 'assistant' && Array.isArray(next.content) && next.content.some(b => b.type === 'component')) return false
      return true
    })
  }, [tamboMessages])

  const timeline = useMemo(() => {
    const items: TimelineItem[] = []
    for (const m of visible) items.push({ kind: 'team', msg: m, seq: seqMap.get(m.id) ?? 0 })
    for (const m of tamboFiltered) items.push({ kind: 'tambo', msg: m, seq: seqMap.get(m.id) ?? 0 })
    items.sort((a, b) => a.seq - b.seq)
    return items
  }, [visible, tamboFiltered, seqMap])

  const slashFiltered = slashQuery !== null ? SLASH_COMMANDS.filter(c => c.startsWith(slashQuery)) : []
  const mentionFiltered = mentionQuery !== null
    ? MENTION_NAMES.filter(n => n.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : []

  return (
    <div className="chat-panel chat-right" style={{ width: chatWidth, maxWidth: chatWidth, flexBasis: chatWidth }} aria-label="Chat panel">
      {tasks && tasks.length > 0 && <TaskChecklist tasks={tasks} />}
      <div className="chat-messages" role="log" aria-label="Chat messages" aria-live="polite">
        <div className="chat-messages-inner">
          {hiddenCount > 0 && (
            <button className="load-older-btn" onClick={() => setChatVisibleCount(c => c + 50)}>
              Load {Math.min(50, hiddenCount)} older messages
            </button>
          )}
          {timeline.map((item, i) => {
            if (item.kind === 'team') {
              const prev = [...timeline.slice(0, i)].reverse().find(t => t.kind === 'team')
              const sameSender = prev?.kind === 'team' && prev.msg.from === item.msg.from
              return (
                <ChatMessage
                  key={item.msg.id}
                  m={item.msg}
                  sameSender={sameSender}
                  agentState={activeAgents.some(a => a.name === item.msg.from) ? getAgentState(item.msg.from) : null}
                  userAvatarUrl={userAvatarUrl}
                  onApproveProposal={onApproveProposal}
                  onRejectProposal={onRejectProposal}
                  onAddTask={onAddTask}
                />
              )
            }
            return <TamboMessage key={item.msg.id} message={item.msg} userAvatarUrl={userAvatarUrl} />
          })}
          {activeAgents.map(agent => {
            const state = getAgentState(agent.name)
            return (state.status === 'thinking' || state.status === 'typing') && !state.inDoc ? (
              <div key={agent.name} className="msg">
                <div className="msg-avatar"><BlobAvatar name={agent.name} size={26} state={state.status} /></div>
                <div className="msg-body">
                  <div className="msg-header"><span className="msg-name">{agent.name}</span></div>
                  <div className="msg-thinking"><span className="thinking-text">{state.thought || 'Thinking...'}</span></div>
                </div>
              </div>
            ) : null
          })}
          {(isStreaming || isPending) && (
            <div className="msg">
              <div className="msg-avatar"><BlobAvatar name="Tambo" size={26} state="thinking" color="#a78bfa" /></div>
              <div className="msg-body">
                <div className="msg-header"><span className="msg-name">Tambo</span></div>
                <div className="msg-thinking"><span className="thinking-text">Thinking...</span></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {messages.length === 0 && (
        <div className="chat-suggestions">
          {['Help me outline a product spec', 'Review my draft for clarity', 'What should this doc cover?', 'Brainstorm ideas for this topic'].map(text => (
            <button key={text} className="chat-suggestion-chip" onClick={() => onSendSuggestion(text)}>{text}</button>
          ))}
        </div>
      )}

      <div className="chat-input">
        {slashFiltered.length > 0 && (
          <div className="mention-dropdown">
            {slashFiltered.map((cmd, i) => (
              <div key={cmd} className={`mention-option ${i === slashIndex ? 'mention-option-active' : ''}`}
                onMouseDown={e => { e.preventDefault(); sendToTambo(tamboPrompt(cmd.slice(1), '')); setSlashQuery(null) }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{cmd}</span>
                <span className="mention-role">{slashDesc(cmd)}</span>
              </div>
            ))}
          </div>
        )}
        {mentionFiltered.length > 0 && (
          <div className="mention-dropdown">
            {mentionFiltered.map((n, i) => {
              const agent = activeAgents.find(x => x.name === n)
              const isTambo = n === 'Tambo'
              return (
                <div key={n} className={`mention-option ${i === Math.min(mentionIndex, mentionFiltered.length - 1) ? 'mention-option-active' : ''}`}
                  onMouseDown={e => { e.preventDefault(); onInputChange(input.slice(0, input.lastIndexOf('@')) + '@' + n + ' '); setMentionQuery(null) }}>
                  <BlobAvatar name={n} size={16} color={isTambo ? '#a78bfa' : undefined} />
                  <span>{n}</span>
                  {agent && <span className="mention-role">{agent.persona.split('.')[0].replace(/^You are \w+, /, '')}</span>}
                  {isTambo && <span className="mention-role">AI assistant with generative UI</span>}
                </div>
              )
            })}
          </div>
        )}
        <textarea
          value={input}
          onChange={e => { handleInputChange(e); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault() }; handleKeyDown(e as unknown as React.KeyboardEvent<HTMLInputElement>) }}
          placeholder={input.startsWith('/') ? 'Type a command...' : 'Message the team... (/ for Tambo)'}
          rows={1}
          style={{ resize: 'none', overflow: 'hidden' }}
        />
      </div>
    </div>
  )
}

const TamboMessage = memo(function TamboMessage({ message, userAvatarUrl }: { message: TamboThreadMessage, userAvatarUrl?: string }) {
  const isUser = message.role === 'user'
  if (!Array.isArray(message.content) || message.content.length === 0) return null

  // Classify blocks
  const hasComponent = message.content.some(b => b.type === 'component')
  const time = message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className={`msg ${isUser ? 'msg-human' : ''}`}>
      <div className="msg-avatar">
        {isUser ? (
          userAvatarUrl ? <img src={userAvatarUrl} alt="You" className="user-avatar" width={26} height={26} /> : <ShapeAvatar name="You" size={26} />
        ) : (
          <BlobAvatar name="Tambo" size={26} color="#a78bfa" />
        )}
      </div>
      <div className="msg-body">
        <div className="msg-header">
          <span className="msg-name">{isUser ? 'You' : 'Tambo'}</span>
          {time && <span className="msg-time">{time}</span>}
        </div>
        {message.content.map((block, idx) => {
          switch (block.type) {
            case 'text': {
              const text = ('text' in block ? (block as { text: string }).text : '').trim()
              if (!text || hasComponent) return null
              return <div key={idx} className="msg-text" style={{ wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: formatMarkdown(text) }} />
            }
            case 'component': {
              const comp = block as TamboComponentContent
              if (!comp.renderedComponent) return null
              return (
                <div key={comp.id ?? idx} style={{ marginTop: 4, maxWidth: '100%', overflow: 'hidden' }}>
                  {comp.renderedComponent}
                </div>
              )
            }
            case 'tool_use': {
              const tool = block as TamboToolUseContent
              if (tool.hasCompleted) return null
              return (
                <div key={tool.id} style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '2px 0' }}>
                  {tool.statusMessage || `Running ${tool.name}...`}
                </div>
              )
            }
            case 'tool_result':
              return null
            default:
              return null
          }
        })}
      </div>
    </div>
  )
})

function slashDesc(cmd: string): string {
  const d: Record<string, string> = { '/outline': 'Document structure', '/analytics': 'Writing stats', '/suggestions': 'Content improvements', '/insights': 'Agent perspectives', '/research': 'Research a topic', '/ask': 'Ask Tambo', '/expand': 'Expand a section', '/summarize': 'Summarize the doc', '/tone': 'Tone & voice check', '/checklist': 'Pre-publish checklist', '/compare': 'Compare approaches' }
  return d[cmd] ?? ''
}

function tamboPrompt(cmd: string, arg: string): string {
  const prompts: Record<string, string> = {
    outline: 'Show me the document outline',
    analytics: 'Show writing analytics for this document',
    suggestions: 'What content improvements would you suggest?',
    insights: 'What does each agent think about this document?',
    research: 'What should I research for this document?',
    ask: 'How can I help with this document?',
    expand: 'Which sections need more detail and what should I add?',
    summarize: 'Give me a concise summary of this document',
    tone: 'Review the tone and voice of this document. Is it consistent? Any suggestions?',
    checklist: 'Create a pre-publish checklist for this document. What is missing or incomplete?',
    compare: 'What are the alternative approaches or trade-offs mentioned in this document?',
  }
  return arg || prompts[cmd] || `/${cmd}`
}

function formatMarkdown(text: string): string {
  // Process code blocks first (before escaping)
  const codeBlocks: string[] = []
  let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = codeBlocks.length
    codeBlocks.push(
      `<pre style="background:var(--surface-3);border-radius:6px;padding:8px 10px;overflow-x:auto;font-size:12px;font-family:var(--font-mono);margin:6px 0;border:1px solid var(--border-subtle)"><code>${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').trimEnd()}</code></pre>`
      + (lang ? `<div style="font-size:10px;color:var(--text-tertiary);margin-top:-4px;margin-bottom:4px">${lang}</div>` : '')
    )
    return `__CODE_BLOCK_${idx}__`
  })

  // Escape HTML
  processed = processed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Headings
  processed = processed.replace(/^#{1,3}\s+(.+)$/gm, '<strong style="display:block;margin:6px 0 2px">$1</strong>')

  // Bold, italic, inline code
  processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>')
  processed = processed.replace(/`(.+?)`/g, '<code style="background:var(--surface-3);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')

  // Line breaks
  processed = processed.replace(/\n/g, '<br/>')

  // Restore code blocks
  for (let i = 0; i < codeBlocks.length; i++) {
    processed = processed.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i])
  }

  return DOMPurify.sanitize(processed)
}
