import type { Command } from '../CommandPalette'
import type { AgentConfig, Session, Message } from '../types'
import { exportPdf } from './pdf-export'

interface CommandContext {
  activeSession: Session | null
  activeAgents: AgentConfig[]
  agentsPaused: boolean
  sidebarCollapsed: boolean
  isLocalhost: boolean
  hasUser: boolean
  editorRef: React.RefObject<{ getText: () => string; getHTML?: () => string } | null>
}

interface CommandActions {
  setShowTemplatePicker: (v: boolean) => void
  handleTogglePause: () => void
  setShowConfigurator: (fn: (v: boolean) => boolean) => void
  setSidebarCollapsed: (fn: (v: boolean) => boolean) => void
  setShowExperiments: (v: boolean) => void
  resetToHome: () => void
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  toast: (t: { type: 'success' | 'error' | 'info', message: string }) => void
  signOut?: () => void
  uid: () => string
  now: () => string
}

export function buildCommands(ctx: CommandContext, actions: CommandActions): Command[] {
  const commands: Command[] = [
    { id: 'new-doc', label: 'New document', shortcut: '\u2318N', action: () => actions.setShowTemplatePicker(true) },
  ]

  if (ctx.activeSession) {
    commands.push(
      { id: 'download-md', label: 'Export as Markdown', shortcut: '\u2318\u21E7E', action: () => {
        const text = ctx.editorRef.current?.getText() || ''
        const title = ctx.activeSession!.title || 'document'
        const blob = new Blob([text], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `${title.slice(0, 40)}.md`; a.click()
        URL.revokeObjectURL(url)
        actions.toast({ type: 'success', message: 'Downloaded as Markdown' })
      }},
      { id: 'download-pdf', label: 'Export as PDF', action: async () => {
        const html = ctx.editorRef.current?.getHTML?.() || ''
        if (!html) {
          actions.toast({ type: 'error', message: 'Nothing to export' })
          return
        }
        const title = ctx.activeSession!.title || 'document'
        actions.toast({ type: 'info', message: 'Preparing PDF…' })
        try {
          await exportPdf({ title, html })
          actions.toast({ type: 'success', message: 'Downloaded as PDF' })
        } catch (err) {
          actions.toast({ type: 'error', message: err instanceof Error ? err.message : 'PDF export failed' })
        }
      }},
      { id: 'toggle-agents', label: ctx.agentsPaused ? 'Resume agents' : 'Pause agents', shortcut: '\u2318\u21E7P', action: actions.handleTogglePause },
      { id: 'configure-agents', label: 'Configure agents', action: () => actions.setShowConfigurator(v => !v) },
    )
  }

  commands.push(
    { id: 'toggle-sidebar', label: ctx.sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar', shortcut: '\u2318\\', action: () => actions.setSidebarCollapsed(v => !v) },
    { id: 'settings', label: 'Settings', shortcut: '\u2318,', action: () => actions.setShowExperiments(true) },
    { id: 'home', label: 'Home', action: actions.resetToHome },
    { id: 'help', label: 'Keyboard shortcuts', shortcut: '?', action: () => {
      actions.setMessages(prev => [...prev, {
        id: actions.uid(),
        from: 'System',
        text: `Shortcuts:\n\u2318N New document\n\u2318K Command palette\n\u2318\\ Toggle sidebar\n\u2318, Settings\n\u2318\u21E7P Pause/resume agents\n\u2318\u21E7E Export Markdown`,
        time: actions.now(),
      }])
    }},
  )

  if (!ctx.isLocalhost && ctx.hasUser && actions.signOut) {
    commands.push({ id: 'signout', label: 'Sign out', action: actions.signOut })
  }

  return commands
}
