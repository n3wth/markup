import { useState } from 'react'
import type { ExperimentSettings } from './types'
import { DEFAULT_EXPERIMENTS } from './types'
import { AGENT_PRESETS } from './AgentConfigurator'

interface Props {
  settings: ExperimentSettings
  onChange: (settings: ExperimentSettings) => void
  onClose: () => void
}

export function ExperimentControls({ settings, onChange, onClose }: Props) {
  const [local, setLocal] = useState(settings)

  const update = <K extends keyof ExperimentSettings>(key: K, value: ExperimentSettings[K]) => {
    const next = { ...local, [key]: value }
    setLocal(next)
    onChange(next)
  }

  const toggleAgent = (name: string) => {
    const current = local.defaultAgentNames
    const next = current.includes(name)
      ? current.filter(n => n !== name)
      : [...current, name]
    if (next.length === 0) return // must have at least one
    update('defaultAgentNames', next)
  }

  const resetAll = () => {
    setLocal({ ...DEFAULT_EXPERIMENTS })
    onChange({ ...DEFAULT_EXPERIMENTS })
  }

  return (
    <div className="exp-overlay" onClick={onClose}>
      <div className="exp-panel" onClick={e => e.stopPropagation()}>
        <div className="exp-header">
          <h2 className="exp-title">Settings</h2>
          <div className="exp-header-actions">
            <button className="exp-reset" onClick={resetAll}>Reset all</button>
            <button className="exp-close" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="exp-body">
          <div className="exp-section">
            <div className="exp-section-label">Default agents</div>
            <div className="exp-agent-grid">
              {AGENT_PRESETS.map(p => {
                const active = local.defaultAgentNames.includes(p.name)
                return (
                  <button
                    key={p.name}
                    className={`exp-agent-chip ${active ? 'exp-agent-active' : ''}`}
                    onClick={() => toggleAgent(p.name)}
                  >
                    <span className="exp-agent-dot" style={{ background: p.color }} />
                    <span className="exp-agent-name">{p.name}</span>
                    <span className="exp-agent-desc">{p.description}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="exp-section">
            <div className="exp-section-label">Agent behavior</div>

            <label className="exp-toggle-row">
              <span className="exp-label">Auto-activate on add</span>
              <button
                className={`exp-toggle ${local.autoActivateOnAdd ? 'exp-toggle-on' : ''}`}
                onClick={() => update('autoActivateOnAdd', !local.autoActivateOnAdd)}
              >
                <span className="exp-toggle-thumb" />
              </button>
            </label>

            <div className="exp-field">
              <div className="exp-field-header">
                <span className="exp-label">Turn limit per agent</span>
                <span className="exp-value">{local.maxTurns}</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                value={local.maxTurns}
                onChange={e => update('maxTurns', Number(e.target.value))}
                className="exp-slider"
              />
            </div>

            <div className="exp-field">
              <div className="exp-field-header">
                <span className="exp-label">Exchange limit</span>
                <span className="exp-value">{local.maxExchanges}</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                value={local.maxExchanges}
                onChange={e => update('maxExchanges', Number(e.target.value))}
                className="exp-slider"
              />
            </div>
          </div>

          <div className="exp-section">
            <div className="exp-section-label">Timing</div>

            <div className="exp-field">
              <div className="exp-field-header">
                <span className="exp-label">Reaction delay</span>
                <span className="exp-value">{(local.reactionDelayMs[0] / 1000).toFixed(1)}s - {(local.reactionDelayMs[1] / 1000).toFixed(1)}s</span>
              </div>
              <div className="exp-range-pair">
                <input
                  type="range"
                  min={0}
                  max={10000}
                  step={500}
                  value={local.reactionDelayMs[0]}
                  onChange={e => {
                    const v = Number(e.target.value)
                    update('reactionDelayMs', [v, Math.max(v, local.reactionDelayMs[1])])
                  }}
                  className="exp-slider"
                />
                <input
                  type="range"
                  min={0}
                  max={10000}
                  step={500}
                  value={local.reactionDelayMs[1]}
                  onChange={e => {
                    const v = Number(e.target.value)
                    update('reactionDelayMs', [Math.min(local.reactionDelayMs[0], v), v])
                  }}
                  className="exp-slider"
                />
              </div>
            </div>

            <div className="exp-field">
              <div className="exp-field-header">
                <span className="exp-label">Heartbeat interval</span>
                <span className="exp-value">{(local.heartbeatDelayMs[0] / 1000).toFixed(0)}s - {(local.heartbeatDelayMs[1] / 1000).toFixed(0)}s</span>
              </div>
              <div className="exp-range-pair">
                <input
                  type="range"
                  min={5000}
                  max={60000}
                  step={1000}
                  value={local.heartbeatDelayMs[0]}
                  onChange={e => {
                    const v = Number(e.target.value)
                    update('heartbeatDelayMs', [v, Math.max(v, local.heartbeatDelayMs[1])])
                  }}
                  className="exp-slider"
                />
                <input
                  type="range"
                  min={5000}
                  max={60000}
                  step={1000}
                  value={local.heartbeatDelayMs[1]}
                  onChange={e => {
                    const v = Number(e.target.value)
                    update('heartbeatDelayMs', [Math.min(local.heartbeatDelayMs[0], v), v])
                  }}
                  className="exp-slider"
                />
              </div>
            </div>
          </div>

          <div className="exp-section">
            <div className="exp-section-label">Advanced</div>

            <div className="exp-field">
              <div className="exp-field-header">
                <span className="exp-label">Insert position strategy</span>
              </div>
              <div className="exp-select-group">
                {(['strict', 'fuzzy', 'always-end'] as const).map(opt => (
                  <button
                    key={opt}
                    className={`exp-select-btn ${local.insertStrategy === opt ? 'exp-select-active' : ''}`}
                    onClick={() => update('insertStrategy', opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <label className="exp-toggle-row">
              <span className="exp-label">Verbose logging</span>
              <button
                className={`exp-toggle ${local.verboseLogging ? 'exp-toggle-on' : ''}`}
                onClick={() => update('verboseLogging', !local.verboseLogging)}
              >
                <span className="exp-toggle-thumb" />
              </button>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
