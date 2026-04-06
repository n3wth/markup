import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  type: ToastType
  message: string
  dismissing: boolean
}

interface ToastOptions {
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_TOASTS = 3
const AUTO_DISMISS_MS = 4000
const FADE_OUT_MS = 300

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function SuccessIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="#30d158" strokeWidth="1.5" />
      <path d="M5 8l2 2 4-4" stroke="#30d158" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="#ff6961" strokeWidth="1.5" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#ff6961" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="var(--text-secondary)" strokeWidth="1.5" />
      <path d="M8 7v4" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.75" fill="var(--text-secondary)" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

interface ToastItemProps {
  item: ToastItem
  onDismiss: (id: string) => void
}

function Toast({ item, onDismiss }: ToastItemProps) {
  return (
    <div
      className={`toast-item toast-item--${item.type} ${item.dismissing ? 'toast-item--dismissing' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <span className="toast-icon">
        {item.type === 'success' && <SuccessIcon />}
        {item.type === 'error' && <ErrorIcon />}
        {item.type === 'info' && <InfoIcon />}
      </span>
      <span className="toast-message">{item.message}</span>
      <button
        className="toast-close"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
      >
        <CloseIcon />
      </button>
    </div>
  )
}

function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-container" aria-label="Notifications">
      {toasts.map(item => (
        <Toast key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    // Start fade-out
    setToasts(prev => prev.map(t => t.id === id ? { ...t, dismissing: true } : t))
    // Remove after animation
    const removeTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timersRef.current.delete(id)
    }, FADE_OUT_MS)
    // Replace any existing auto-dismiss timer with the remove timer
    const existing = timersRef.current.get(id)
    if (existing) clearTimeout(existing)
    timersRef.current.set(id, removeTimer)
  }, [])

  const toast = useCallback(({ type, message }: ToastOptions) => {
    const id = uid()
    setToasts(prev => {
      const next = [...prev, { id, type, message, dismissing: false }]
      // Drop oldest if over max (trim from front)
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
    })
    // Auto-dismiss after delay
    const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    timersRef.current.set(id, timer)
  }, [dismiss])

  // Cleanup all timers on unmount
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(t => clearTimeout(t))
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
