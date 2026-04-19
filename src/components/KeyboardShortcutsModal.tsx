import { useEffect, useRef } from 'react'

interface Shortcut {
  keys: string
  label: string
}

const SHORTCUTS: Shortcut[] = [
  { keys: '\u2318 N', label: 'New document' },
  { keys: '\u2318 K', label: 'Open command palette' },
  { keys: '\u2318 ,', label: 'Open settings' },
  { keys: '\u2318 \\', label: 'Toggle sidebar' },
  { keys: '\u2318 \u21E7 P', label: 'Pause or resume agents' },
  { keys: '?', label: 'Show this help' },
  { keys: 'Esc', label: 'Close this dialog' },
]

interface Props {
  onClose: () => void
}

export function KeyboardShortcutsModal({ onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="kbd-help-overlay"
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="kbd-help-panel" role="dialog" aria-modal="true" aria-labelledby="kbd-help-title">
        <div className="kbd-help-header">
          <h2 className="kbd-help-title" id="kbd-help-title">Keyboard shortcuts</h2>
          <button type="button" className="kbd-help-close" onClick={onClose} aria-label="Close">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <dl className="kbd-help-list">
          {SHORTCUTS.map(s => (
            <div key={s.keys} className="kbd-help-row">
              <dt><kbd>{s.keys}</kbd></dt>
              <dd>{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
