import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { AgentCursors } from './agent-cursor'
import { DocMinimap } from './doc-minimap'
import { Sidebar } from './Sidebar'
import { CommandPalette, type Command } from './CommandPalette'
import { invalidateApiKeyCache } from './AgentConfigurator'
import { loadUserSettings, saveGeminiApiKey } from './lib/settings-store'

// Lazy-loaded components (not needed on initial render)
const LoginPage = lazy(() => import('./LoginPage').then(m => ({ default: m.LoginPage })))
const LegalPage = lazy(() => import('./LegalPage').then(m => ({ default: m.LegalPage })))
const TemplatePickerModal = lazy(() => import('./TemplatePickerModal').then(m => ({ default: m.TemplatePickerModal })))
import type { GoogleDocFile } from './TemplatePickerModal'
const SettingsModal = lazy(() => import('./SettingsModal').then(m => ({ default: m.SettingsModal })))
const ExperimentControls = lazy(() => import('./ExperimentControls').then(m => ({ default: m.ExperimentControls })))
import { saveDocument, updateSessionTitle, saveChatMessage } from './lib/session-store'
import { identify, events } from './lib/analytics'
import { TamboProvider } from '@tambo-ai/react'
import { tamboComponents } from './lib/tambo'
import { useAuth } from './lib/auth'
import type { Session, AgentState, TimelineEntry, ExperimentSettings } from './types'
import { DEFAULT_EXPERIMENTS } from './types'
// ColorPanels removed -- home dashboard no longer uses shader background
import './App.css'

// Extracted components
import { SessionHeader } from './components/SessionHeader'
import { EditorPanel } from './components/EditorPanel'
import { TamboChat } from './components/TamboChat'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useToast } from './components/Toast'
import { ProgressBar } from './components/ProgressBar'

// Custom hooks
import { useOrchestrator } from './hooks/useOrchestrator'
import { useSession, now, uid } from './hooks/useSession'


const EMPTY_DOC = '<h1>Untitled</h1><p></p>'

function App() {
  const { user, loading: authLoading, signOut, providerToken, signInWithGoogle } = useAuth()
  const { toast } = useToast()

  // PostHog user identification (init handled by PostHogProvider in main.tsx)
  useEffect(() => {
    if (user) identify(user.id, { email: user.email })
  }, [user])

  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [chatWidth, setChatWidth] = useState(340)
  const [agentsPaused, setAgentsPaused] = useState(false)
  const agentsPausedRef = useRef(false)
  const resizingRef = useRef<'sidebar' | 'chat' | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const [showConfigurator, setShowConfigurator] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showExperiments, setShowExperiments] = useState(false)
  const [experimentSettings, setExperimentSettings] = useState<ExperimentSettings>({ ...DEFAULT_EXPERIMENTS })
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [driveStatus, setDriveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({})
  const getAgentState = (name: string): AgentState => agentStates[name] || { status: 'idle', inDoc: false }
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const editorRef = useRef<import('@tiptap/react').Editor | null>(null)
  const docSaveTimer = useRef<number | null>(null)
  const docEditTimer = useRef<number | null>(null)
  const lastDocSnapshot = useRef('')

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing here. Your AI team will review as you go.' }),
      AgentCursors,
      DocMinimap.configure({
        agentColors: { Aiden: '#30d158', Nova: '#ff6961', Lex: '#64d2ff', Mira: '#ffd60a' },
      }),
    ],
    content: EMPTY_DOC,
    editorProps: {
      attributes: {
        class: 'doc-editor',
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Debounced save to Supabase
      if (docSaveTimer.current) clearTimeout(docSaveTimer.current)
      docSaveTimer.current = window.setTimeout(() => {
        setSaveStatus('saving')
        const session = activeSessionRef.current
        if (session) {
          saveDocument(session.id, ed.getHTML())
            .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000) })
            .catch(err => { console.error('[App] saveDocument error:', err); setSaveStatus('idle'); toast({ type: 'error', message: 'Failed to save document' }) })
          // Sync title from first H1
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const json = ed.getJSON() as any
          const h1 = json.content?.find((n: any) => n.type === 'heading' && n.attrs?.level === 1)
          const h1Text = h1?.content?.map((c: any) => c.text || '').join('') || ''
          if (h1Text && h1Text !== session.title) {
            setActiveSession(s => s ? { ...s, title: h1Text } : s)
            updateSessionTitle(session.id, h1Text).catch(err =>
              console.error('[App] updateSessionTitle error:', err)
            )
          }
        }
      }, 2000)
      // Detect user typing in doc
      if (docEditTimer.current) clearTimeout(docEditTimer.current)
      docEditTimer.current = window.setTimeout(() => {
        const currentText = ed.getText()
        const prev = lastDocSnapshot.current
        if (!prev) { lastDocSnapshot.current = currentText; return }
        let i = 0
        while (i < prev.length && i < currentText.length && prev[i] === currentText[i]) i++
        const added = currentText.slice(i, currentText.length - (prev.length - i))
        lastDocSnapshot.current = currentText
        if (added.trim().length > 15 && orchestratorRef.current) {
          orchestratorRef.current.trigger('user-message', {
            instruction: `The user just typed this in the document: "${added.trim().slice(0, 200)}". React to it — if it's an instruction, follow it. If it's content, build on it.`,
          })
        }
      }, 3000)
    },
  })
  editorRef.current = editor

  useEffect(() => {
    if (editor) lastDocSnapshot.current = editor.getText()
  }, [editor])

  useEffect(() => {
    return () => {
      if (docSaveTimer.current) clearTimeout(docSaveTimer.current)
      if (docEditTimer.current) clearTimeout(docEditTimer.current)
    }
  }, [])

  // Chat state
  const [messages, setMessages] = useState<import('./types').Message[]>([])
  const [input, setInput] = useState('')
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const lastProcessedMsg = useRef(0)

  // Stable orchestrator ref -- shared between useSession and useOrchestrator
  const orchestratorRef = useRef<ReturnType<typeof import('./orchestrator').createOrchestrator> | null>(null)

  // Session hook
  const {
    activeSession, setActiveSession, activeSessionRef,
    sessions, setSessions, sessionsLoaded,
    activeAgents, setActiveAgents,
    handleSessionSelect, handleTemplatePick, handleGoogleImport,
    resetToHome,
  } = useSession({
    editor,
    setMessages,
    setTimeline,
    setAgentStates,
    setSaveStatus,
    lastDocSnapshot,
    lastProcessedMsg,
    orchestratorRef,
    messagesRef,
  })

  // Orchestrator hook -- populates orchestratorRef
  useOrchestrator({
    editorRef,
    messagesRef,
    activeAgents,
    activeSessionRef,
    agentsPausedRef,
    setAgentStates,
    setTimeline,
    setMessages,
    setSessions,
    setActiveSession,
    orchestratorRef,
    experimentSettings,
  })

  // Forward new messages to orchestrator
  useEffect(() => {
    const newMsgs = messages.slice(lastProcessedMsg.current)
    lastProcessedMsg.current = messages.length
    for (const m of newMsgs) {
      orchestratorRef.current?.onMessage(m.from, m.text)
    }
  }, [messages, orchestratorRef])

  const handleSendMessage = useCallback(() => {
    if (!input.trim()) return
    const text = input.trim()
    setMessages(m => [...m, { id: uid(), from: 'You', text, time: now() }])
    setInput('')
    const session = activeSessionRef.current
    if (session) {
      saveChatMessage(session.id, { sender: 'You', text }).catch(err =>
        console.error('[App] saveChatMessage error:', err)
      )
    }
    const mentioned = activeAgents.filter(a => text.toLowerCase().includes(a.name.toLowerCase())).map(a => a.name)
    events.messageSent(session?.id || '', mentioned)
    orchestratorRef.current?.trigger('user-message', { instruction: text })
  }, [input, activeSessionRef, orchestratorRef, activeAgents])

  const handleSendSuggestion = useCallback((text: string) => {
    setMessages(m => [...m, { id: uid(), from: 'You', text, time: now() }])
    setInput('')
    const session = activeSessionRef.current
    if (session) {
      saveChatMessage(session.id, { sender: 'You', text }).catch(err =>
        console.error('[App] saveChatMessage error:', err)
      )
    }
    orchestratorRef.current?.trigger('user-message', { instruction: text })
  }, [activeSessionRef, orchestratorRef])

  // Cmd+N to create new doc, Cmd+K for command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        setShowTemplatePicker(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  const params = new URLSearchParams(window.location.search)

  // Load user settings (API key) on auth
  useEffect(() => {
    if (user) {
      loadUserSettings(user.id).then(settings => {
        const key = settings.gemini_api_key || ''
        setGeminiApiKey(key)
        if (key) { localStorage.setItem('collab-gemini-api-key', key); invalidateApiKeyCache() }
      })
    } else {
      setGeminiApiKey(localStorage.getItem('collab-gemini-api-key') || '')
    }
  }, [user])

  // Panel resize handlers
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      e.preventDefault()
      if (resizingRef.current === 'sidebar') {
        const w = e.clientX
        if (w < 120) {
          setSidebarCollapsed(true)
          setSidebarWidth(240)
          resizingRef.current = null
          document.body.style.cursor = ''
        } else {
          setSidebarWidth(Math.max(180, Math.min(400, w)))
        }
      } else if (resizingRef.current === 'chat') {
        const w = window.innerWidth - e.clientX
        setChatWidth(Math.max(260, Math.min(500, w)))
      }
    }
    const onMouseUp = () => {
      resizingRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const startResize = (panel: 'sidebar' | 'chat') => {
    resizingRef.current = panel
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handleTogglePause = useCallback(() => {
    setAgentsPaused(v => {
      const next = !v
      agentsPausedRef.current = next
      if (next) {
        orchestratorRef.current?.destroy()
        orchestratorRef.current = null
        setAgentStates({})
      }
      // On unpause, useOrchestrator's useEffect will recreate and trigger doc-opened
      return next
    })
  }, [orchestratorRef, setAgentStates])

  // Legal pages -- accessible without auth
  if (window.location.pathname === '/privacy') return <Suspense><LegalPage page="privacy" /></Suspense>
  if (window.location.pathname === '/terms') return <Suspense><LegalPage page="terms" /></Suspense>

  // Login page for unauthenticated users (non-localhost)
  if (!isLocalhost && authLoading) {
    return <div className="app-shell" style={{ background: 'var(--surface-0)' }} />
  }

  if (params.has('login') || (!isLocalhost && !user)) {
    return <Suspense><LoginPage /></Suspense>
  }

  return (
    <div className={`app-shell ${activeSession ? 'app-shell-active' : ''}`}>
      <div className="app-layout">
      <div className="app-sidebar-column" style={{ width: sidebarCollapsed ? 0 : sidebarWidth, flexShrink: 0, overflow: 'hidden' }}>
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSession?.id ?? null}
          onSelect={(session: Session) => handleSessionSelect(session, [])}
          onNewDoc={() => setShowTemplatePicker(true)}
          onDelete={(id) => { setSessions(s => s.filter(x => x.id !== id)); if (activeSession?.id === id) resetToHome() }}
          onRename={(id, title) => {
            updateSessionTitle(id, title).catch(console.error)
            setSessions(s => s.map(x => x.id === id ? { ...x, title } : x))
            if (activeSession?.id === id) setActiveSession(s => s ? { ...s, title } : s)
          }}
          onCollapse={() => setSidebarCollapsed(v => !v)}
          collapsed={sidebarCollapsed}
          user={user ?? null}
          onSignOut={isLocalhost ? undefined : signOut}
          onHome={resetToHome}
          onSettings={() => setShowSettings(true)}
        />
      </div>
      {!sidebarCollapsed && activeSession && (
        <div className="resize-handle" onMouseDown={() => startResize('sidebar')} />
      )}
      <div className="app-main-column">
      {activeSession && (
        <SessionHeader
          activeSession={activeSession}
          activeAgents={activeAgents}
          getAgentState={getAgentState}
          agentsPaused={agentsPaused}
          onTogglePause={handleTogglePause}
          chatWidth={chatWidth}
          saveStatus={saveStatus}
          showConfigurator={showConfigurator}
          onToggleConfigurator={() => setShowConfigurator(v => !v)}
          onAgentsChange={setActiveAgents}
          activeSessionRef={activeSessionRef}
        />
      )}
      <div className="app-body">
        {activeSession ? (
          <div className="workspace-area">
            <ProgressBar active={saveStatus === 'saving'} />
            <div className="workspace-content">
            {editor && (
              <ErrorBoundary>
                <EditorPanel
                  editor={editor}
                  timeline={timeline}
                  activeSession={activeSession}
                  driveStatus={driveStatus}
                  setDriveStatus={setDriveStatus}
                  user={user}
                  providerToken={providerToken}
                  signInWithGoogle={signInWithGoogle}
                  setMessages={setMessages}
                  now={now}
                  uid={uid}
                />
              </ErrorBoundary>
            )}
            <div className="resize-handle" onMouseDown={() => startResize('chat')} />
            <ErrorBoundary>
              <TamboProvider
                apiKey={import.meta.env.VITE_TAMBO_API_KEY as string || ''}
                components={tamboComponents}
                userKey={user?.id ?? 'local-dev'}
                contextHelpers={{
                  documentContent: () => {
                    const text = editorRef.current?.getText() || ''
                    const html = editorRef.current?.getHTML() || ''
                    const title = activeSession?.title || 'Untitled'
                    return `# Current Document: "${title}"\n\n${text}\n\n---\nHTML structure:\n${html}`
                  },
                  activeAgents: () => {
                    return activeAgents.map(a => `${a.name}: ${a.description || a.persona.split('.')[0]}`).join('\n')
                  },
                }}
              >
                <TamboChat
                  messages={messages}
                  activeAgents={activeAgents}
                  getAgentState={getAgentState}
                  userAvatarUrl={user?.user_metadata?.avatar_url}
                  input={input}
                  onInputChange={setInput}
                  onSend={handleSendMessage}
                  onSendSuggestion={handleSendSuggestion}
                  onApproveProposal={(id) => {
                    setMessages(prev => {
                      const msg = prev.find(x => x.id === id)
                      if (msg?.proposal?.type === 'edit' && msg.proposal.status === 'pending') {
                        orchestratorRef.current?.applyApprovedEdit(msg.from, msg.proposal.edit)
                      }
                      if (msg?.proposal?.type === 'create-doc') setShowTemplatePicker(true)
                      return prev.map(m => m.id === id && m.proposal ? { ...m, proposal: { ...m.proposal, status: 'approved' as const } } : m)
                    })
                  }}
                  onRejectProposal={(id) => {
                    setMessages(prev => prev.map(msg => msg.id === id && msg.proposal ? { ...msg, proposal: { ...msg.proposal, status: 'rejected' as const } } : msg))
                  }}
                  chatWidth={chatWidth}
                />
              </TamboProvider>
            </ErrorBoundary>
            </div>
          </div>
        ) : (
          <div className="home-dashboard">
            {sessionsLoaded && sessions.length > 0 ? (
              <>
                <div className="home-greeting">
                  <h2 className="home-greeting-text">What are you working on?</h2>
                  <p className="home-greeting-sub">Pick up a recent doc or start fresh.</p>
                </div>
                <div className="home-section">
                  <div className="home-starter-grid">
                    {[
                      { label: 'Blank', desc: 'Empty canvas' },
                      { label: 'Product Brief', desc: 'Aiden + Nova' },
                      { label: 'Tech Spec', desc: 'Aiden + Lex' },
                      { label: 'Full Team', desc: 'All 4 agents' },
                    ].map(s => (
                      <button key={s.label} className="home-starter-card" onClick={() => setShowTemplatePicker(true)}>
                        <span className="home-starter-label">{s.label}</span>
                        <span className="home-starter-desc">{s.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="home-section">
                  <h2 className="home-section-title">Recent</h2>
                  <div className="home-doc-grid">
                    {sessions.slice(0, 6).map(s => (
                      <button key={s.id} className="home-doc-card" onClick={() => handleSessionSelect(s, [])}>
                        <span className="home-doc-title">{s.title || 'Untitled'}</span>
                        <span className="home-doc-meta">{new Date(s.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="home-shortcuts">
                  <span className="home-shortcut"><kbd>&#8984;N</kbd> New doc</span>
                  <span className="home-shortcut"><kbd>&#8984;K</kbd> Commands</span>
                </div>
              </>
            ) : sessionsLoaded ? (
              <div className="home-welcome">
                <h2 className="home-welcome-title">Your AI writing team.</h2>
                <p className="home-welcome-desc">Create a document. Agents read along, challenge assumptions, and fill gaps in real time.</p>
                <button className="home-welcome-cta" onClick={() => setShowTemplatePicker(true)}>
                  New document
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
      </div>
      </div>
      {showSettings && (
        <Suspense>
          <SettingsModal
            apiKey={geminiApiKey}
            onSave={async (key) => {
              if (user) await saveGeminiApiKey(user.id, key)
              localStorage.setItem('collab-gemini-api-key', key)
              invalidateApiKeyCache()
              setGeminiApiKey(key)
            }}
            onClose={() => setShowSettings(false)}
          />
        </Suspense>
      )}
      {showExperiments && (
        <Suspense>
          <ExperimentControls
            settings={experimentSettings}
            onChange={setExperimentSettings}
            onClose={() => setShowExperiments(false)}
          />
        </Suspense>
      )}
      {showTemplatePicker && (
        <Suspense>
          <TemplatePickerModal
            onSelect={(starter) => {
              setShowTemplatePicker(false)
              handleTemplatePick(starter)
            }}
            onImport={(file: GoogleDocFile) => {
              setShowTemplatePicker(false)
              handleGoogleImport(file)
            }}
            onClose={() => setShowTemplatePicker(false)}
            importAvailable={!!user}
          />
        </Suspense>
      )}
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          commands={[
            { id: 'new-doc', label: 'New document', shortcut: '\u2318N', action: () => setShowTemplatePicker(true) },
            { id: 'toggle-sidebar', label: sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar', action: () => setSidebarCollapsed(v => !v) },
            { id: 'experiments', label: 'Experiments — tune agent behavior', action: () => setShowExperiments(true) },
            ...(activeSession ? [
              { id: 'download-md', label: 'Download as Markdown', action: () => {
                const text = editorRef.current?.getText() || ''
                const title = activeSession.title || 'document'
                const blob = new Blob([text], { type: 'text/markdown' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = `${title.slice(0, 40)}.md`; a.click()
                URL.revokeObjectURL(url)
                toast({ type: 'success', message: 'Downloaded as Markdown' })
              }},
              { id: 'home', label: 'Go home', action: resetToHome },
            ] as Command[] : []),
            { id: 'help', label: 'Agent help — what can agents do?', shortcut: '?', action: () => {
              const helpText = activeAgents.map(a => {
                const role = a.persona.split('.')[0].replace(/^You are \w+, /, '')
                return `${a.name}: ${role}`
              }).join('\n')
              setMessages(prev => [...prev, {
                id: uid(),
                from: 'System',
                text: `Your AI team:\n${helpText}\n\nAgents can: edit documents, chat, search the web, rename docs, and observe document quality. @mention any agent to direct them.`,
                time: now(),
              }])
            }},
            ...(!isLocalhost && user ? [{ id: 'signout', label: 'Sign out', action: signOut }] as Command[] : []),
          ]}
        />
      )}
    </div>
  )
}

export default App
