import { useState, useEffect, useCallback, lazy, Suspense, createContext, useContext } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { navigate } from './router-navigate'

export { navigate } from './router-navigate'

// ---------------------------------------------------------------------------
// Router context — lets any component read the current path and navigate
// ---------------------------------------------------------------------------

type RouterContextValue = {
  pathname: string
  navigate: (to: string, opts?: { replace?: boolean }) => void
}

const RouterContext = createContext<RouterContextValue>({
  pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
  navigate: () => {},
})

export function useRouter() {
  return useContext(RouterContext)
}

// ---------------------------------------------------------------------------
// Page components (lazy-loaded per-route)
// ---------------------------------------------------------------------------

const MarketingPage = lazy(() =>
  import('../MarketingPage').then(m => ({ default: m.MarketingPage }))
)
const FeaturesPage = lazy(() =>
  import('./FeaturesPage').then(m => ({ default: m.FeaturesPage }))
)
const PricingPage = lazy(() =>
  import('./PricingPage').then(m => ({ default: m.PricingPage }))
)
const AboutPage = lazy(() =>
  import('./AboutPage').then(m => ({ default: m.AboutPage }))
)
const UseCasesPage = lazy(() =>
  import('./UseCasesPage').then(m => ({ default: m.UseCasesPage }))
)
const AgentsPage = lazy(() =>
  import('./AgentsPage').then(m => ({ default: m.AgentsPage }))
)
const ChangelogPage = lazy(() =>
  import('../ChangelogPage').then(m => ({ default: m.ChangelogPage }))
)
const LegalPage = lazy(() =>
  import('../LegalPage').then(m => ({ default: m.LegalPage }))
)

// Routes handled by this SPA router (all logged-out pages)
const MARKETING_ROUTES = new Set([
  '/',
  '/features',
  '/pricing',
  '/about',
  '/use-cases',
  '/agents',
  '/changelog',
  '/privacy',
  '/terms',
])

export function isMarketingPath(pathname: string): boolean {
  return MARKETING_ROUTES.has(pathname)
}

function resolveRoute(pathname: string): React.ReactNode {
  switch (pathname) {
    case '/features':
      return <FeaturesPage />
    case '/pricing':
      return <PricingPage />
    case '/about':
      return <AboutPage />
    case '/use-cases':
      return <UseCasesPage />
    case '/agents':
      return <AgentsPage />
    case '/changelog':
      return <ChangelogPage />
    case '/privacy':
      return <LegalPage page="privacy" />
    case '/terms':
      return <LegalPage page="terms" />
    default:
      return <MarketingPage />
  }
}

// ---------------------------------------------------------------------------
// Page transition variants — subtle fade + slight upward drift
// ---------------------------------------------------------------------------

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
}

const pageTransition = {
  duration: 0.22,
  ease: [0.4, 0, 0.2, 1] as const,
}

// ---------------------------------------------------------------------------
// MarketingRouter — SPA shell for all logged-out pages
// ---------------------------------------------------------------------------

export function MarketingRouter() {
  const [pathname, setPathname] = useState(window.location.pathname)

  const handleNavigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    navigate(to, opts)
  }, [])

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname)
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Intercept clicks on <a> tags that point to marketing-internal paths
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as Element).closest('a')
      if (!target) return
      const href = target.getAttribute('href')
      if (!href) return
      // Only intercept same-origin, marketing paths, no modifier keys
      if (
        !href.startsWith('/') ||
        !isMarketingPath(href) ||
        e.metaKey || e.ctrlKey || e.shiftKey || e.altKey ||
        target.target === '_blank'
      ) return
      e.preventDefault()
      handleNavigate(href)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [handleNavigate])

  return (
    <RouterContext.Provider value={{ pathname, navigate: handleNavigate }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={pageTransition}
          style={{ minHeight: '100vh' }}
        >
          <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--surface-0)' }} />}>
            {resolveRoute(pathname)}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </RouterContext.Provider>
  )
}
