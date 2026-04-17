import { useEffect, useRef } from 'react'

interface ShortcutActions {
  newDoc: () => void
  toggleCommandPalette: () => void
  toggleSettings: () => void
  toggleSidebar: () => void
  togglePause: () => void
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
  // Use ref for togglePause to avoid stale closure issues
  const togglePauseRef = useRef(actions.togglePause)
  useEffect(() => { togglePauseRef.current = actions.togglePause })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'n') { e.preventDefault(); actions.newDoc() }
      if (mod && e.key === 'k') { e.preventDefault(); actions.toggleCommandPalette() }
      if (mod && e.key === ',') { e.preventDefault(); actions.toggleSettings() }
      if (mod && e.key === '\\') { e.preventDefault(); actions.toggleSidebar() }
      if (mod && e.shiftKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); togglePauseRef.current() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions.newDoc, actions.toggleCommandPalette, actions.toggleSettings, actions.toggleSidebar])
}
