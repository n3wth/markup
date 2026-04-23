import { useEffect, useState } from 'react'

const MOBILE_QUERY = '(max-width: 767.98px)'

/**
 * True when the viewport is narrower than Tailwind's `md` breakpoint (768px).
 * Drives the mobile tab layout in App.tsx and mobile-only UI affordances.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(MOBILE_QUERY).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(MOBILE_QUERY)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
