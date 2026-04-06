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
  const widths = ['70%', '85%', '55%', '75%', '60%', '80%', '50%', '65%']
  return (
    <div className="skeleton-sidebar">
      {widths.map((w, i) => (
        <div key={i} className="skeleton-sidebar-row">
          <SkeletonBlock width={w} height="14px" radius="6px" />
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
