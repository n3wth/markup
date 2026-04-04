import type React from 'react'

interface DataPoint {
  label: string
  value: number
}

interface DataChartProps {
  title: string
  data: DataPoint[]
  type: 'bar' | 'horizontal-bar'
  unit?: string
  caption?: string
}

export const DataChart: React.FC<DataChartProps> = ({ title, data, type, unit, caption }) => {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.value))
  const min = Math.min(...data.map(d => d.value))
  const range = max - min || 1
  // Use 0-based scaling if values vary a lot, range-based if close together
  const useRangeScale = range < max * 0.3

  return (
    <div style={{
      fontFamily: 'var(--font-body)',
      color: 'var(--text-primary)',
      background: 'var(--surface-2)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-default)',
      padding: '10px 12px',
      fontSize: 14,
      overflow: 'hidden',
    }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{title}</div>

      {type === 'bar' ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, paddingTop: 8 }}>
          {data.map((d, i) => {
            const pct = useRangeScale
              ? 30 + ((d.value - min) / range) * 70  // 30-100% range for close values
              : max > 0 ? (d.value / max) * 100 : 0
            const barHeight = Math.max(6, (pct / 100) * 100)
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {d.value}{unit ? ` ${unit}` : ''}
                </span>
                <div style={{
                  width: '80%',
                  maxWidth: 36,
                  height: barHeight,
                  background: `hsl(${260 + i * 25}, 55%, 58%)`,
                  borderRadius: '3px 3px 0 0',
                }} />
                <span style={{
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  textAlign: 'center',
                }}>
                  {d.label}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.map((d, i) => {
            const pct = useRangeScale
              ? 30 + ((d.value - min) / range) * 70
              : max > 0 ? (d.value / max) * 100 : 0
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  width: 60,
                  flexShrink: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {d.label}
                </span>
                <div style={{ flex: 1, height: 8, background: 'var(--surface-3)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: `hsl(${260 + i * 20}, 60%, 60%)`,
                    borderRadius: 4,
                    transition: 'width 300ms ease',
                  }} />
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', width: 40, textAlign: 'right', flexShrink: 0 }}>
                  {d.value}{unit || ''}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {caption && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>{caption}</div>
      )}
    </div>
  )
}
