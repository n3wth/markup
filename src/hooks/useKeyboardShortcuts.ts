import { useEffect, useRef } from 'react'

interface ShortcutActions {
  newDoc: () => void
  toggleCommandPalette: () => void
  toggleSettings: () => void
  toggleSidebar: () => void
  togglePause: () => void
  toggleShortcutsHelp?: () => void
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
  const { newDoc, toggleCommandPalette, toggleSettings, toggleSidebar, togglePause, toggleShortcutsHelp } = actions

  // Use ref for togglePause to avoid stale closure issues
  const togglePauseRef = useRef(togglePause)
  useEffect(() => { togglePauseRef.current = togglePause })
  const toggleShortcutsHelpRef = useRef(toggleShortcutsHelp)
  useEffect(() => { toggleShortcutsHelpRef.current = toggleShortcutsHelp })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'n') { e.preventDefault(); newDoc() }
      if (mod && e.key === 'k') { e.preventDefault(); toggleCommandPalette() }
      if (mod && e.key === ',') { e.preventDefault(); toggleSettings() }
      if (mod && e.key === '\\') { e.preventDefault(); toggleSidebar() }
      if (mod && e.shiftKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); togglePauseRef.current() }
      // "?" only fires outside input/contenteditable, and not when a modifier is held.
      if (!mod && e.key === '?' && toggleShortcutsHelpRef.current) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        const editable = target?.isContentEditable
        if (editable || tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        toggleShortcutsHelpRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newDoc, toggleCommandPalette, toggleSettings, toggleSidebar])
}
