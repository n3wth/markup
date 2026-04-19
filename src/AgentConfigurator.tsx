import { useState } from 'react'
import { BlobAvatar } from './blob-avatar'
import { AGENT_PRESETS as PRESETS } from './lib/agent-presets'
import type { AgentConfig } from './types'

interface Props {
  agents: AgentConfig[]
  onChange: (agents: AgentConfig[]) => void
}

export function AgentConfigurator({ agents, onChange }: Props) {
  const [editing, setEditing] = useState<number | null>(null)

  const addPreset = (preset: AgentConfig) => {
    if (agents.length >= 4) return
    const name = agents.some(a => a.name === preset.name)
      ? `${preset.name} ${agents.length + 1}`
      : preset.name
    onChange([...agents, { ...preset, name }])
  }

  const remove = (idx: number) => {
    onChange(agents.filter((_, i) => i !== idx))
    if (editing === idx) setEditing(null)
  }

  const update = (idx: number, patch: Partial<AgentConfig>) => {
    onChange(agents.map((a, i) => i === idx ? { ...a, ...patch } : a))
  }

  const availablePresets = PRESETS.filter(pr => !agents.some(a => a.name === pr.name))

  return (
    <div className="agent-configurator">
      <div className="ac-active">
        <div className="ac-label">Active agents</div>
        <div className="ac-cards">
          {agents.map((a, i) => (
            <div key={a.name + i} className="ac-card" style={{ borderColor: `${a.color}40` }}>
              {editing === i ? (
                <div className="ac-edit">
                  <div className="ac-edit-row">
                    <label className="ac-field">
                      <span className="ac-field-label">Name</span>
                      <input value={a.name} onChange={e => update(i, { name: e.target.value })} />
                    </label>
                    <label className="ac-field">
                      <span className="ac-field-label">Owner</span>
                      <input value={a.owner} onChange={e => update(i, { owner: e.target.value })} />
                    </label>
                  </div>
                  <label className="ac-field">
                    <span className="ac-field-label">Description</span>
                    <input value={a.description} onChange={e => update(i, { description: e.target.value })} />
                  </label>
                  <label className="ac-field">
                    <span className="ac-field-label">System prompt</span>
                    <textarea value={a.persona} onChange={e => update(i, { persona: e.target.value })} rows={3} />
                  </label>
                  <button type="button" className="ac-done-btn" onClick={() => setEditing(null)}>Done</button>
                </div>
              ) : (
                <div className="ac-view">
                  <div className="ac-card-top">
                    <BlobAvatar name={a.name} size={28} color={a.color} />
                    <div className="ac-card-info">
                      <span className="ac-card-name">{a.name}</span>
                      <span className="ac-card-desc">{a.description}</span>
                    </div>
                    <div className="ac-card-dot" style={{ background: a.color }} />
                  </div>
                  <div className="ac-card-actions">
                    <button type="button" className="ac-btn" onClick={() => setEditing(i)}>Edit</button>
                    {agents.length > 1 && <button type="button" className="ac-btn ac-btn-remove" onClick={() => remove(i)}>Remove</button>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {agents.length < 4 && availablePresets.length > 0 && (
        <div className="ac-add">
          <div className="ac-label">Add agent</div>
          <div className="ac-preset-grid">
            {availablePresets.map(pr => (
              <button type="button" key={pr.name} className="ac-preset-card" onClick={() => addPreset(pr)}>
                <BlobAvatar name={pr.name} size={24} color={pr.color} />
                <div className="ac-preset-info">
                  <span className="ac-preset-name">{pr.name}</span>
                  <span className="ac-preset-desc">{pr.description}</span>
                </div>
                <div className="ac-card-dot" style={{ background: pr.color }} />
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

