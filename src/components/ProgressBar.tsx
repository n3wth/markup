interface Props {
  active: boolean
}

export function ProgressBar({ active }: Props) {
  if (!active) return null

  return (
    <div className="progress-bar">
      <div className="progress-bar-fill" />
    </div>
  )
}
