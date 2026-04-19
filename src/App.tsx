import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
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
const KeyboardShortcutsModal = lazy(() => import('./components/KeyboardShortcutsModal').then(m => ({ default: m.KeyboardShortcutsModal })))
import { updateSessionTitle, saveChatMessage, saveAgentTasks, updateAgentTask, subscribeToDocument } from './lib/session-store'
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
import { useOrchestratorWiring } from './hooks/use-orchestrator-wiring'
import { useSession, now, uid } from './hooks/useSession'
import { useMarkupEditor } from './hooks/use-markup-editor'
import { useSessionState } from './hooks/use-session-state'


/** How long "Saved" stays visible in the header before fading. */
const SAVED_STATUS_FADE_MS = 2000

/** Debounce before the doc is persisted to Supabase after a keystroke. */
const DOC_SAVE_DEBOUNCE_MS = 2000

/** Idle time before typed doc content is surfaced to the orchestrator. */
const DOC_EDIT_REACT_DEBOUNCE_MS = 3000

function App() {
  const { user, loading: authLoading, signOut, providerToken, signInWithGoogle } = useAuth()
  const { toast } = useToast()

  // Read-only spectator mode: /s/:id?view=1 — doc is not editable and
  // agents don't run. Lets a second human tail the session without the
  // orchestrator fighting over writes.
  const isViewMode = new URLSearchParams(window.location.search).has('view')
  // Tracks whether Realtime has already populated the editor for this
  // session. If so, the initial loadDocument snapshot (which may be
  // older) must not overwrite it during hydration.
  const suppressDocHydrateRef = useRef(false)

  // PostHog user identification (init handled by PostHogProvider in main.tsx)
  useEffect(() => {
    if (user) identify(user.id, { email: user.email })
  }, [user])

  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
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
  const getAgentState = (name: string): AgentState => agentStates[name] || { status: 'idle', inDoc: false }
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])

  // Stable orchestrator ref -- shared between useMarkupEditor, useSession,
  // and useOrchestratorWiring. Created at the App level because all three
  // hooks need to read from / write to the same cell, and a ref is just a
  // transport container.
  const orchestratorRef = useRef<ReturnType<typeof import('./orchestrator').createOrchestrator> | null>(null)

  // Session state hook -- owns activeSession/messages/tasks/agentStates +
  // their setters and mirror refs. Called first so useMarkupEditor can
  // consume activeSessionRef/setActiveSession directly.
  const {
    activeSession, setActiveSession, activeSessionRef,
    messages, setMessages, messagesRef,
    tasks, setTasks, tasksRef,
    agentStates, setAgentStates,
  } = useSessionState()

  // Editor hook owns the Tiptap instance, extensions, save debounce, and user-edit detection.
  const { editor, editorRef, lastDocSnapshot } = useMarkupEditor({
    isViewMode,
    orchestratorRef,
    setSaveStatus,
    activeSessionRef,
    setActiveSession,
    toast,
    docSaveDebounceMs: DOC_SAVE_DEBOUNCE_MS,
    docEditReactDebounceMs: DOC_EDIT_REACT_DEBOUNCE_MS,
    savedStatusFadeMs: SAVED_STATUS_FADE_MS,
  })

  // Chat input is local UI state, not session-scoped.
  const [input, setInput] = useState('')
  const lastProcessedMsg = useRef(0)

  // Work plan + pending starter are modal-scoped; belong alongside input.
  const [workPlan, setWorkPlan] = useState<{ presetId: string; presetTitle: string; tasks: Pick<AgentTask, 'title' | 'assignedAgents' | 'sectionAnchor' | 'order'>[] } | null>(null)
  const pendingStarterRef = useRef<{ id: string; title: string; template: import('./types').DocTemplate; agents: import('./types').AgentConfig[] } | null>(null)

  // Session flow hook -- owns hydration, URL routing, template picking.
  // Reads/writes session state via the refs + setters from useSessionState.
  const {
    sessions, setSessions, sessionsLoaded,
    activeAgents, setActiveAgents,
    handleSessionSelect, handleTemplatePick, handleGoogleImport,
    resetToHome,
  } = useSession({
    editor,
    activeSession,
    setActiveSession,
    activeSessionRef,
    setMessages,
    setTimeline,
    setAgentStates,
    setSaveStatus,
    lastDocSnapshot,
    lastProcessedMsg,
    orchestratorRef,
    messagesRef,
    setTasks,
    suppressDocHydrateRef,
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
  }, [setMessages, setTasks, tasksRef])

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
  }, [activeSessionRef, setTasks, tasksRef])

  // Orchestrator wiring hook -- owns orchestrator creation/destroy,
  // callback subscriptions, message forwarding, and pause. Populates
  // `orchestratorRef` so sibling hooks (useMarkupEditor, useSession) can
  // trigger events.
  const { pause: pauseOrchestrator } = useOrchestratorWiring({
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
    messages,
    lastProcessedMsgRef: lastProcessedMsg,
  })

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
  }, [input, activeSessionRef, orchestratorRef, activeAgents, setMessages])

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
  }, [activeSessionRef, orchestratorRef, setMessages])

  // Global keyboard shortcuts (extracted to hook)
  const togglePauseRef = useRef<() => void>(() => {})
  useKeyboardShortcuts({
    newDoc: () => setShowTemplatePicker(true),
    toggleCommandPalette: () => setShowCommandPalette(v => !v),
    toggleSettings: () => setShowExperiments(v => !v),
    toggleSidebar: () => setSidebarCollapsed(v => !v),
    togglePause: () => togglePauseRef.current(),
    toggleShortcutsHelp: () => setShowShortcutsHelp(v => !v),
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
      // Mark that Realtime has delivered authoritative content for this
      // session so any late loadDocument hydration doesn't overwrite us
      // with an older snapshot.
      suppressDocHydrateRef.current = true
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
        pauseOrchestrator()
      }
      // On unpause, useOrchestratorWiring's useEffect will recreate and trigger doc-opened
      return next
    })
  }, [pauseOrchestrator])
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
            { activeSession, activeAgents, agentsPaused, sidebarCollapsed, isLocalhost, hasUser: !!user, editorRef: editorRef as React.RefObject<{ getText: () => string; getHTML: () => string } | null> },
            // eslint-disable-next-line react-hooks/refs
            { setShowTemplatePicker, handleTogglePause, setShowConfigurator, setSidebarCollapsed, setShowExperiments, resetToHome, setMessages, toast, signOut, uid, now },
          )}
        />
      )}
      {showShortcutsHelp && (
        <Suspense>
          <KeyboardShortcutsModal onClose={() => setShowShortcutsHelp(false)} />
        </Suspense>
      )}
    </div>
  )
}

export default App
