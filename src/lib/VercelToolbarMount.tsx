import { useEffect } from 'react'
import { useAuth } from './auth-context'

const TOOLBAR_OWNER_EMAIL = 'oliver@newth.ai'

/**
 * Mounts the Vercel Toolbar for the site owner so inline comments can be left
 * on the deployed markup.so. Gated to a single email — Vercel's docs warn that
 * mounting unconditionally prompts every visitor to log in.
 */
export function VercelToolbarMount() {
  const { user } = useAuth()
  const isOwner = user?.email === TOOLBAR_OWNER_EMAIL

  useEffect(() => {
    if (!isOwner) return
    let unmount: (() => void) | undefined
    let cancelled = false
    import('@vercel/toolbar').then(({ mountVercelToolbar }) => {
      if (cancelled) return
      unmount = mountVercelToolbar()
    })
    return () => {
      cancelled = true
      unmount?.()
    }
  }, [isOwner])

  return null
}
