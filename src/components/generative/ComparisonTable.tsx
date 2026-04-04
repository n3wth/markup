import type React from 'react'

interface Column {
  name: string
  rows: { label: string, value: string }[]
}

interface ComparisonTableProps {
  title: string
  columns: Column[]
  highlightColumn?: string
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({
  title,
  columns,
  highlightColumn,
}) => {
  const rowLabels = columns.length > 0
    ? columns[0].rows.map(r => r.label)
    : []

  return (
    <div
      style={{
        fontFamily: 'var(--font-body)',
        color: 'var(--text-primary)',
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        padding: '10px 12px',
        fontSize: 14,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: 14,
          lineHeight: 1.3,
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {title}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '4px 6px',
                  color: 'var(--text-tertiary)',
                  fontWeight: 500,
                  fontSize: 11,
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              />
              {columns.map((col) => (
                <th
                  key={col.name}
                  style={{
                    textAlign: 'left',
                    padding: '4px 6px',
                    fontWeight: 600,
                    fontSize: 12,
                    borderBottom: '1px solid var(--border-subtle)',
                    borderLeft: col.name === highlightColumn
                      ? '2px solid var(--agent-lex)'
                      : 'none',
                    borderRight: col.name === highlightColumn
                      ? '2px solid var(--agent-lex)'
                      : 'none',
                    borderTop: col.name === highlightColumn
                      ? '2px solid var(--agent-lex)'
                      : 'none',
                    borderTopLeftRadius: col.name === highlightColumn ? 4 : 0,
                    borderTopRightRadius: col.name === highlightColumn ? 4 : 0,
                    color: col.name === highlightColumn
                      ? 'var(--agent-lex)'
                      : 'var(--text-primary)',
                  }}
                >
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((label, ri) => (
              <tr key={label}>
                <td
                  style={{
                    padding: '4px 6px',
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                    fontSize: 11,
                    whiteSpace: 'nowrap',
                    borderBottom: ri < rowLabels.length - 1
                      ? '1px solid var(--border-subtle)'
                      : 'none',
                  }}
                >
                  {label}
                </td>
                {columns.map((col) => {
                  const isLast = ri === rowLabels.length - 1
                  const cellValue = col.rows.find(r => r.label === label)?.value ?? ''
                  return (
                    <td
                      key={col.name}
                      style={{
                        padding: '4px 6px',
                        color: 'var(--text-primary)',
                        fontSize: 12,
                        borderBottom: ri < rowLabels.length - 1
                          ? '1px solid var(--border-subtle)'
                          : 'none',
                        borderLeft: col.name === highlightColumn
                          ? '2px solid var(--agent-lex)'
                          : 'none',
                        borderRight: col.name === highlightColumn
                          ? '2px solid var(--agent-lex)'
                          : 'none',
                        borderBottomLeftRadius: isLast && col.name === highlightColumn ? 4 : 0,
                        borderBottomRightRadius: isLast && col.name === highlightColumn ? 4 : 0,
                        borderBottomColor: isLast && col.name === highlightColumn
                          ? 'var(--agent-lex)'
                          : undefined,
                        borderBottomWidth: isLast && col.name === highlightColumn ? 2 : undefined,
                        borderBottomStyle: isLast && col.name === highlightColumn ? 'solid' : undefined,
                      }}
                    >
                      {cellValue}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
