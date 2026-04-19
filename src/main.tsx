import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PostHogProvider } from '@posthog/react'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import { AuthProvider } from './lib/auth.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import App from './App.tsx'

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string
const posthogHost = (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string) || 'https://us.i.posthog.com'

const root = createRoot(document.getElementById('root')!)

if (posthogKey) {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <PostHogProvider apiKey={posthogKey} options={{ api_host: posthogHost, autocapture: false, capture_pageview: false, persistence: 'localStorage' }}>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </PostHogProvider>
        <Analytics />
      </ErrorBoundary>
    </StrictMode>,
  )
} else {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
        <Analytics />
      </ErrorBoundary>
    </StrictMode>,
  )
}
