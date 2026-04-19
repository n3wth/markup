import { memo } from 'react'

interface Props {
  active: boolean
}

export const ProgressBar = memo(function ProgressBar({ active }: Props) {
  if (!active) return null

  return (
    <div className="progress-bar">
      <div className="progress-bar-fill" />
    </div>
  )
})
