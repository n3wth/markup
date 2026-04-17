import { useEffect, useRef } from 'react'

interface ShortcutActions {
  newDoc: () => void
  toggleCommandPalette: () => void
  toggleSettings: () => void
  toggleSidebar: () => void
  togglePause: () => void
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
  const { newDoc, toggleCommandPalette, toggleSettings, toggleSidebar, togglePause } = actions

  // Use ref for togglePause to avoid stale closure issues
  const togglePauseRef = useRef(togglePause)
  useEffect(() => { togglePauseRef.current = togglePause })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'n') { e.preventDefault(); newDoc() }
      if (mod && e.key === 'k') { e.preventDefault(); toggleCommandPalette() }
      if (mod && e.key === ',') { e.preventDefault(); toggleSettings() }
      if (mod && e.key === '\\') { e.preventDefault(); toggleSidebar() }
      if (mod && e.shiftKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); togglePauseRef.current() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newDoc, toggleCommandPalette, toggleSettings, toggleSidebar])
}
