import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

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

const variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const transition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const }

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transition}
        style={{ width: '100%' }}
      >
        <Suspense fallback={null}>
          <Routes location={location}>
            <Route path="/" element={<MarketingPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/use-cases" element={<UseCasesPage />} />
            <Route path="/agents" element={<AgentsPage />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}

export function MarketingRouter() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  )
}

