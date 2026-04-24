import { useEffect, useState } from 'react'
import type { ExperimentSettings } from './types'
import { DEFAULT_EXPERIMENTS } from './types'
import { AGENT_PRESETS } from './lib/agent-presets'
import { getOllamaSettings, saveOllamaSettings, DEFAULT_OLLAMA_URL, DEFAULT_OLLAMA_MODEL } from './lib/ollama-settings'
import { resetRateLimiter } from './agent'

interface Props {
  settings: ExperimentSettings
  onChange: (settings: ExperimentSettings) => void
  onClose: () => void
  apiKey?: string
  onSaveApiKey?: (key: string) => Promise<void>
}

export function ExperimentControls({ settings, onChange, onClose, apiKey, onSaveApiKey }: Props) {
  const [local, setLocal] = useState(settings)
  const [keyValue, setKeyValue] = useState(apiKey || '')
  const [keyVisible, setKeyVisible] = useState(false)
  const [keySaving, setKeySaving] = useState(false)
  const [keySaved, setKeySaved] = useState(false)

  const storedOllama = getOllamaSettings()
  const [ollamaUrl, setOllamaUrl] = useState(storedOllama.url || '')
  const [ollamaModel, setOllamaModel] = useState(storedOllama.model || '')
  const [ollamaSaved, setOllamaSaved] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const saveOllama = () => {
    saveOllamaSettings({
      url: ollamaUrl.trim() || DEFAULT_OLLAMA_URL,
      model: ollamaModel.trim() || DEFAULT_OLLAMA_MODEL,
    })
    resetRateLimiter()
    setOllamaSaved(true)
    setTimeout(() => setOllamaSaved(false), 2000)
  }

  return (
    <div className="exp-overlay" onClick={onClose}>
      <div className="exp-panel" role="dialog" aria-modal="true" aria-labelledby="exp-title" onClick={e => e.stopPropagation()}>
        <div className="exp-header">
          <h2 className="exp-title" id="exp-title">Settings</h2>
          <div className="exp-header-actions">
            <button type="button" className="exp-reset" onClick={resetAll}>Reset all</button>
            <button type="button" className="exp-close" onClick={onClose} aria-label="Close settings">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="exp-body">
          {onSaveApiKey && (
            <div className="exp-section">
              <div className="exp-section-label">API key</div>
              <div className="exp-field">
                <div className="exp-key-row">
                  <input
                    type={keyVisible ? 'text' : 'password'}
                    value={keyValue}
                    onChange={e => { setKeyValue(e.target.value); setKeySaved(false) }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && onSaveApiKey) {
                        setKeySaving(true)
                        onSaveApiKey(keyValue).then(() => { setKeySaved(true); setKeySaving(false) }).catch(() => setKeySaving(false))
                      }
                    }}
                    placeholder="Paste your Gemini API key"
                    className="exp-key-input"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button type="button" className="exp-key-toggle" onClick={() => setKeyVisible(v => !v)} title={keyVisible ? 'Hide' : 'Show'}>
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {keyVisible ? (
                        <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
                      ) : (
                        <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                      )}
                    </svg>
                  </button>
                </div>
                <div className="exp-key-footer">
                  <span className="exp-key-hint">
                    Used when no server key is configured.{' '}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Get a key</a>
                  </span>
                  <button type="button"
                    className="exp-key-save"
                    disabled={keySaving || keySaved}
                    onClick={() => {
                      if (!onSaveApiKey) return
                      setKeySaving(true)
                      onSaveApiKey(keyValue).then(() => { setKeySaved(true); setKeySaving(false) }).catch(() => setKeySaving(false))
                    }}
                  >
                    {keySaving ? 'Saving...' : keySaved ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="exp-section">
            <div className="exp-section-label">Ollama (local models)</div>
            <div className="exp-field">
              <div className="exp-field-header">
                <span className="exp-label">Base URL</span>
              </div>
              <input
                type="text"
                value={ollamaUrl}
                onChange={e => { setOllamaUrl(e.target.value); setOllamaSaved(false) }}
                placeholder={DEFAULT_OLLAMA_URL}
                className="exp-key-input"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <div className="exp-field">
              <div className="exp-field-header">
                <span className="exp-label">Model</span>
              </div>
              <div className="exp-key-row">
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={e => { setOllamaModel(e.target.value); setOllamaSaved(false) }}
                  placeholder={DEFAULT_OLLAMA_MODEL}
                  className="exp-key-input"
                  spellCheck={false}
                  autoComplete="off"
                />
                <button type="button" className="exp-key-save" disabled={ollamaSaved} onClick={saveOllama}>
                  {ollamaSaved ? 'Saved' : 'Save'}
                </button>
              </div>
              <div className="exp-key-footer">
                <span className="exp-key-hint">
                  When set, agents use Ollama instead of Gemini. Leave blank to use Gemini.
                </span>
              </div>
            </div>
          </div>

          <div className="exp-section">
            <div className="exp-section-label">Default agents</div>
            <div className="exp-agent-grid">
              {AGENT_PRESETS.map(p => {
                const active = local.defaultAgentNames.includes(p.name)
                return (
                  <button type="button"
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
              <button type="button"
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
                  <button type="button"
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
              <button type="button"
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
