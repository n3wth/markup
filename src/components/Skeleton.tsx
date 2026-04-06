export function SkeletonBlock({
  width = '100%',
  height = '16px',
  radius = '8px',
}: {
  width?: string
  height?: string
  radius?: string
}) {
  return (
    <div
      className="skeleton-block"
      style={{ width, height, borderRadius: radius }}
    />
  )
}

export function SidebarSkeleton() {
  const rows = [
    { wide: '70%', narrow: '45%' },
    { wide: '85%', narrow: '55%' },
    { wide: '60%', narrow: '40%' },
    { wide: '75%', narrow: '50%' },
  ]
  return (
    <div className="skeleton-sidebar">
      {rows.map((row, i) => (
        <div key={i} className="skeleton-sidebar-row">
          <SkeletonBlock width="28px" height="28px" radius="50%" />
          <div className="skeleton-sidebar-lines">
            <SkeletonBlock width={row.wide} height="12px" radius="6px" />
            <SkeletonBlock width={row.narrow} height="10px" radius="6px" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ChatSkeleton() {
  const bubbles = [
    { width: '65%', height: '48px', align: 'flex-start' },
    { width: '75%', height: '56px', align: 'flex-end' },
    { width: '60%', height: '44px', align: 'flex-start' },
  ]
  return (
    <div className="skeleton-chat">
      {bubbles.map((b, i) => (
        <SkeletonBlock
          key={i}
          width={b.width}
          height={b.height}
          radius="12px"
        />
      ))}
    </div>
  )
}
