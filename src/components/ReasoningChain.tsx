import { useState } from 'react'

export function ReasoningChain({ steps }: { steps: string[] }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`reasoning-chain ${expanded ? 'expanded' : ''}`}>
      <button
        type="button"
        className="reasoning-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Hide reasoning steps' : 'Show reasoning steps'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`reasoning-chevron ${expanded ? 'open' : ''}`} aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="reasoning-label">{steps.length} {steps.length === 1 ? 'step' : 'steps'}</span>
      </button>
      {expanded && (
        <div className="reasoning-steps">
          {steps.map((step, i) => (
            <div key={i} className="reasoning-step">
              <span className="reasoning-step-num">{i + 1}</span>
              <span className="reasoning-step-text">{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
