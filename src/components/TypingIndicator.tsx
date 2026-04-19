import { memo } from 'react'
import type { AgentRhythm } from '../types'

interface Props {
  name: string
  color: string
  rhythm?: AgentRhythm
  thought?: string
}

// Rhythm tunings: dot stagger and overall cycle. Burst is fast and tight,
// careful is slow with long pauses, steady sits in between.
const RHYTHMS: Record<AgentRhythm, { duration: number; stagger: number }> = {
  burst: { duration: 0.7, stagger: 0.08 },
  steady: { duration: 1.2, stagger: 0.18 },
  careful: { duration: 1.9, stagger: 0.34 },
}

export const TypingIndicator = memo(function TypingIndicator({ name, color, rhythm = 'steady', thought }: Props) {
  const { duration, stagger } = RHYTHMS[rhythm] ?? RHYTHMS.steady
  return (
    <div className="agent-typing" data-rhythm={rhythm}>
      <span className="agent-typing-name" style={{ color }}>{name}</span>
      <span className="agent-typing-verb">is typing</span>
      <span className="agent-typing-dots" aria-hidden="true">
        <span className="agent-typing-dot" style={{ background: color, animationDuration: `${duration}s`, animationDelay: '0s' }} />
        <span className="agent-typing-dot" style={{ background: color, animationDuration: `${duration}s`, animationDelay: `${stagger}s` }} />
        <span className="agent-typing-dot" style={{ background: color, animationDuration: `${duration}s`, animationDelay: `${stagger * 2}s` }} />
      </span>
      {thought && <span className="agent-typing-thought">{thought}</span>}
    </div>
  )
})
