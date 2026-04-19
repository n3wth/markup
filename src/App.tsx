import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { useEditor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { AgentCursors } from './agent-cursor'
import { DocMinimap } from './doc-minimap'
import { Sidebar } from './Sidebar'
import { CommandPalette } from './CommandPalette'
import { invalidateApiKeyCache } from './lib/api-key-cache'
import { loadUserSettings, saveGeminiApiKey } from './lib/settings-store'

// Lazy-loaded components (not needed on initial render)
const LoginPage = lazy(() => import('./LoginPage').then(m => ({ default: m.LoginPage })))
const LegalPage = lazy(() => import('./LegalPage').then(m => ({ default: m.LegalPage })))
const TemplatePickerModal = lazy(() => import('./TemplatePickerModal').then(m => ({ default: m.TemplatePickerModal })))
import type { GoogleDocFile } from './TemplatePickerModal'
const ExperimentControls = lazy(() => import('./ExperimentControls').then(m => ({ default: m.ExperimentControls })))
import { saveDocument, updateSessionTitle, saveChatMessage, saveAgentTasks, updateAgentTask, subscribeToDocument } from './lib/session-store'
import { identify, events } from './lib/analytics'
import { TamboProvider } from '@tambo-ai/react'
import { tamboComponents } from './lib/tambo'
import { useAuth } from './lib/auth-context'
import type { Session, AgentState, TimelineEntry, ExperimentSettings, AgentTask, TaskActionPayload } from './types'
import { DEFAULT_EXPERIMENTS } from './types'
import './App.css'

// Extracted components
import { SessionHeader } from './components/SessionHeader'
import { EditorPanel } from './components/EditorPanel'
import { TamboChat } from './components/TamboChat'
import { ErrorBoundary } from './components/ErrorBoundary'
import { HomeDashboard } from './components/HomeDashboard'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { buildCommands } from './lib/commands'
import { useToast } from './lib/toast-context'
import { ProgressBar } from './components/ProgressBar'
import { WorkPlanCard } from './components/WorkPlanCard'
import { resolvePresetTasks } from './task-presets'

// Custom hooks
import { useOrchestrator } from './hooks/useOrchestrator'
import { useSession, now, uid } from './hooks/useSession'


const EMPTY_DOC = '<h1>Untitled</h1><p></p>'

function App() {
  const { user, loading: authLoading, signOut, providerToken, signInWithGoogle } = useAuth()
  const { toast } = useToast()

  // Read-only spectator mode: /s/:id?view=1 — doc is not editable and
  // agents don't run. Lets a second human tail the session without the
  // orchestrator fighting over writes.
  const isViewMode = new URLSearchParams(window.location.search).has('view')

  // PostHog user identification (init handled by PostHogProvider in main.tsx)
  useEffect(() => {
    if (user) identify(user.id, { email: user.email })
  }, [user])

  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [chatWidth, setChatWidth] = useState(340)
  const [agentsPaused, setAgentsPaused] = useState(isViewMode)
  const agentsPausedRef = useRef(isViewMode)
  const resizingRef = useRef<'sidebar' | 'chat' | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const [showConfigurator, setShowConfigurator] = useState(false)
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
    editable: !isViewMode,
    editorProps: {
      attributes: {
        class: `doc-editor${isViewMode ? ' doc-editor-view' : ''}`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Spectators never write. Initial loadDocument()/template hydration
      // still fires onUpdate (no emitUpdate:false there), and without this
      // guard a delayed Realtime delivery could cause a view-mode client to
      // save an older snapshot back over newer author edits.
      if (isViewMode) return
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
          const json = ed.getJSON() as JSONContent
          const h1 = json.content?.find(n => n.type === 'heading' && n.attrs?.level === 1)
          const h1Text = h1?.content?.map(c => c.text || '').join('') || ''
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
  useEffect(() => { editorRef.current = editor })

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
  useEffect(() => { messagesRef.current = messages })
  const lastProcessedMsg = useRef(0)

  // Task state
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const tasksRef = useRef(tasks)
  useEffect(() => { tasksRef.current = tasks })
  const [workPlan, setWorkPlan] = useState<{ presetId: string; presetTitle: string; tasks: Pick<AgentTask, 'title' | 'assignedAgents' | 'sectionAnchor' | 'order'>[] } | null>(null)
  const pendingStarterRef = useRef<{ id: string; title: string; template: import('./types').DocTemplate; agents: import('./types').AgentConfig[] } | null>(null)

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
    setTasks,
  })

  // Task callbacks (must be after useSession for activeSessionRef)
  const handleTaskAction = useCallback((agent: string, action: TaskActionPayload) => {
    if (action.type === 'complete' && action.taskId) {
      setTasks(prev => prev.map(t =>
        t.id === action.taskId ? { ...t, status: 'complete' as const, completedBy: agent, completedAt: new Date().toISOString() } : t
      ))
      const task = tasksRef.current.find(t => t.id === action.taskId)
      if (task) {
        updateAgentTask(action.taskId, { status: 'complete', completedBy: agent }).catch(console.error)
        setMessages(prev => [...prev, {
          id: uid(), from: 'System', text: '', time: now(),
          taskEvent: { type: 'completed', taskId: action.taskId!, title: task.title },
        }])
      }
    } else if (action.type === 'propose' && action.title) {
      setMessages(prev => [...prev, {
        id: uid(), from: agent, text: action.rationale || '', time: now(),
        taskEvent: {
          type: 'proposed',
          task: { title: action.title!, assignedAgents: action.assignedAgents || [agent], sectionAnchor: action.sectionAnchor },
          rationale: action.rationale,
        },
      }])
    }
  }, [setMessages])

  const handleAddTask = useCallback((task: Pick<AgentTask, 'title' | 'assignedAgents' | 'sectionAnchor'>) => {
    const session = activeSessionRef.current
    if (!session) return
    const newTask: Omit<AgentTask, 'id' | 'createdAt' | 'completedAt'> = {
      sessionId: session.id,
      title: task.title,
      status: 'pending',
      assignedAgents: task.assignedAgents,
      createdBy: 'user',
      sectionAnchor: task.sectionAnchor,
      order: tasksRef.current.length + 1,
    }
    saveAgentTasks(session.id, [newTask]).then(saved => {
      if (saved.length > 0) setTasks(prev => [...prev, ...saved])
    }).catch(console.error)
  }, [activeSessionRef])

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
    tasksRef,
    onTaskAction: handleTaskAction,
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

  // Global keyboard shortcuts (extracted to hook)
  const togglePauseRef = useRef<() => void>(() => {})
  useKeyboardShortcuts({
    newDoc: () => setShowTemplatePicker(true),
    toggleCommandPalette: () => setShowCommandPalette(v => !v),
    toggleSettings: () => setShowExperiments(v => !v),
    toggleSidebar: () => setSidebarCollapsed(v => !v),
    togglePause: () => togglePauseRef.current(),
  })

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

  // Spectator live-stream: in view mode, subscribe to Realtime updates on
  // the document and push them into the read-only editor. Depend on
  // activeSession.id specifically — the full object reference churns on
  // unrelated property changes (e.g. title sync), which would otherwise
  // tear down and re-open the channel mid-flight and drop updates.
  useEffect(() => {
    if (!isViewMode || !editor || !activeSession?.id) return
    const unsubscribe = subscribeToDocument(activeSession.id, (html) => {
      if (editor.isDestroyed) return
      if (editor.getHTML() === html) return
      editor.commands.setContent(html, { emitUpdate: false })
    })
    return unsubscribe
  }, [isViewMode, editor, activeSession?.id])

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
  useEffect(() => { togglePauseRef.current = handleTogglePause })

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
          sessionsLoaded={sessionsLoaded}
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
          onSettings={() => setShowExperiments(true)}
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
          isViewMode={isViewMode}
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
                  tasks={tasks}
                  agentStates={agentStates}
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
                  onAddTask={handleAddTask}
                  tasks={tasks}
                  chatWidth={chatWidth}
                />
              </TamboProvider>
            </ErrorBoundary>
            </div>
          </div>
        ) : (
          <HomeDashboard
            activeAgents={activeAgents}
            sessions={sessions}
            sessionsLoaded={sessionsLoaded}
            onNewDoc={() => setShowTemplatePicker(true)}
            onSelectSession={(s) => handleSessionSelect(s, [])}
            onStarterPick={(starter) => {
              const resolvedTasks = resolvePresetTasks(starter.id, starter.agents.map(a => a.name))
              if (resolvedTasks.length > 0) {
                // Store starter for later and show work plan
                pendingStarterRef.current = starter
                setWorkPlan({ presetId: starter.id, presetTitle: starter.title, tasks: resolvedTasks })
              } else {
                handleTemplatePick(starter)
              }
            }}
          />
        )}
      </div>
      </div>
      </div>
      {workPlan && (
        <WorkPlanCard
          presetTitle={workPlan.presetTitle}
          tasks={workPlan.tasks}
          onStart={async (finalTasks) => {
            const starter = pendingStarterRef.current
            if (!starter) return
            pendingStarterRef.current = null
            setWorkPlan(null)
            // Create the session via normal flow
            await handleTemplatePick(starter)
            // Save tasks to the newly created session
            const session = activeSessionRef.current
            if (session && finalTasks.length > 0) {
              const taskRows = finalTasks.map((t, i) => ({
                sessionId: session.id,
                title: t.title,
                status: 'pending' as const,
                assignedAgents: t.assignedAgents,
                createdBy: 'user',
                sectionAnchor: t.sectionAnchor,
                order: i + 1,
              }))
              saveAgentTasks(session.id, taskRows).then(saved => {
                setTasks(saved)
              }).catch(console.error)
            }
          }}
          onCancel={() => {
            pendingStarterRef.current = null
            setWorkPlan(null)
          }}
        />
      )}
      {showExperiments && (
        <Suspense>
          <ExperimentControls
            settings={experimentSettings}
            onChange={setExperimentSettings}
            onClose={() => setShowExperiments(false)}
            apiKey={geminiApiKey}
            onSaveApiKey={async (key) => {
              if (user) await saveGeminiApiKey(user.id, key)
              localStorage.setItem('collab-gemini-api-key', key)
              invalidateApiKeyCache()
              setGeminiApiKey(key)
            }}
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
          commands={buildCommands(
            // editorRef is dereferenced only inside command action callbacks, never during render.
            // eslint-disable-next-line react-hooks/refs
            { activeSession, activeAgents, agentsPaused, sidebarCollapsed, isLocalhost, hasUser: !!user, editorRef: editorRef as React.RefObject<{ getText: () => string } | null> },
            // eslint-disable-next-line react-hooks/refs
            { setShowTemplatePicker, handleTogglePause, setShowConfigurator, setSidebarCollapsed, setShowExperiments, resetToHome, setMessages, toast, signOut, uid, now },
          )}
        />
      )}
    </div>
  )
}

export default App
