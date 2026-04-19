import { useEffect, useRef } from 'react'
import { useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { AgentCursors } from '../agent-cursor'
import { DocMinimap } from '../doc-minimap'
import { saveDocument, updateSessionTitle } from '../lib/session-store'
import type { Session } from '../types'
import type { createOrchestrator } from '../orchestrator'

const EMPTY_DOC = '<h1>Untitled</h1><p></p>'

/**
 * Mutable callbacks bag for {@link useMarkupEditor}. The hook reads these at
 * debounce-fire time (not at construction), so the caller can populate them
 * *after* sibling hooks (`useSession`) have created their setters. Any field
 * may be null until the caller wires it up.
 */
export interface MarkupEditorCallbacks {
  /** Session state getter — read at save-time, after debounce. */
  getActiveSession: (() => Session | null) | null
  /** Session title updater — called when the doc's H1 changes. */
  setActiveSession: React.Dispatch<React.SetStateAction<Session | null>> | null
}

export interface UseMarkupEditorOptions {
  /** View mode makes the editor read-only and skips save/user-edit side effects. */
  isViewMode: boolean
  /** Ref to the orchestrator — doc edits trigger `user-message` when populated. */
  orchestratorRef: React.RefObject<ReturnType<typeof createOrchestrator> | null>
  /** Called when the save lifecycle transitions (saving → saved → idle). */
  setSaveStatus: React.Dispatch<React.SetStateAction<'saved' | 'saving' | 'idle'>>
  /**
   * Ref holding the current session callbacks. The caller is responsible for
   * updating `.current` each render so the editor's debounced save always
   * reads the freshest setter/getter.
   */
  callbacksRef: React.RefObject<MarkupEditorCallbacks>
  /** Toast surface for user-facing save errors. */
  toast: (opts: { type: 'error'; message: string }) => void
  /** Debounce before persisting to Supabase after a keystroke. */
  docSaveDebounceMs: number
  /** Debounce before typed doc content is surfaced to the orchestrator. */
  docEditReactDebounceMs: number
  /** How long "Saved" stays visible in the header before fading. */
  savedStatusFadeMs: number
}

export interface UseMarkupEditorResult {
  /** Tiptap editor instance (null on first render). */
  editor: Editor | null
  /** Mirror ref of the editor — safe to read from async callbacks and other hooks. */
  editorRef: React.RefObject<Editor | null>
  /** Last observed plain-text snapshot; shared with useSession so hydration can seed it. */
  lastDocSnapshot: React.MutableRefObject<string>
}

/**
 * Owns the Tiptap editor instance, its extensions, and the debounced save /
 * user-edit detection loop that used to live inline in App.tsx.
 *
 * The hook's surface is deliberately minimal: it emits the editor plus two
 * refs (`editorRef`, `lastDocSnapshot`) that other hooks (useSession,
 * useOrchestrator) need to reach into. Session, messaging, and task callbacks
 * are intentionally *not* threaded through here — those belong in sibling
 * hooks.
 *
 * Session-facing callbacks are read lazily via {@link MarkupEditorCallbacks}
 * so the caller can create the editor before `useSession` has produced its
 * setters.
 */
export function useMarkupEditor(options: UseMarkupEditorOptions): UseMarkupEditorResult {
  const {
    isViewMode,
    orchestratorRef,
    setSaveStatus,
    callbacksRef,
    toast,
    docSaveDebounceMs,
    docEditReactDebounceMs,
    savedStatusFadeMs,
  } = options

  const editorRef = useRef<Editor | null>(null)
  const docSaveTimer = useRef<number | null>(null)
  const docEditTimer = useRef<number | null>(null)
  const savedStatusTimer = useRef<number | null>(null)
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
        const { getActiveSession, setActiveSession } = callbacksRef.current
        const session = getActiveSession?.() ?? null
        if (session) {
          saveDocument(session.id, ed.getHTML())
            .then(() => {
              setSaveStatus('saved')
              if (savedStatusTimer.current) clearTimeout(savedStatusTimer.current)
              savedStatusTimer.current = window.setTimeout(() => setSaveStatus('idle'), savedStatusFadeMs)
            })
            .catch(err => { console.error('[App] saveDocument error:', err); setSaveStatus('idle'); toast({ type: 'error', message: 'Failed to save document' }) })
          // Sync title from first H1
          const json = ed.getJSON() as JSONContent
          const h1 = json.content?.find(n => n.type === 'heading' && n.attrs?.level === 1)
          const h1Text = h1?.content?.map(c => c.text || '').join('') || ''
          if (h1Text && h1Text !== session.title) {
            setActiveSession?.(s => s ? { ...s, title: h1Text } : s)
            updateSessionTitle(session.id, h1Text).catch(err =>
              console.error('[App] updateSessionTitle error:', err)
            )
          }
        }
      }, docSaveDebounceMs)
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
      }, docEditReactDebounceMs)
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

  return { editor, editorRef, lastDocSnapshot }
}
