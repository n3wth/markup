import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { createWarmthTracker } from '../lib/warmth-tracker'

/**
 * Drives a `--warmth` CSS custom property on a target element from editor
 * activity. The value is in [0, 1] and decays toward 0 between edits, so the
 * editor surface subtly shifts color temperature as the session warms up and
 * cools down. Designed to be barely perceptible — the visual mapping is owned
 * by CSS (see `.doc-panel` in App.css), this hook just supplies the signal.
 *
 * Updates are RAF-driven so the value writes to the DOM at most once per
 * frame regardless of edit cadence. Idle frames stop scheduling once the
 * value rounds to zero, so a quiet editor costs nothing.
 */
export function useWarmthGradient(
  editor: Editor | null,
  targetRef: React.RefObject<HTMLElement | null>,
) {
  const trackerRef = useRef(createWarmthTracker())

  useEffect(() => {
    if (!editor) return

    let rafId: number | null = null
    let lastWritten = -1

    const tick = () => {
      rafId = null
      const el = targetRef.current
      if (!el) return
      const v = trackerRef.current.value()
      // Quantize to 3 decimal places — sub-millivisual differences don't warrant
      // a style mutation, and equal writes still trigger style recalc.
      const q = Math.round(v * 1000) / 1000
      if (q !== lastWritten) {
        el.style.setProperty('--warmth', String(q))
        lastWritten = q
      }
      // Keep ticking while the value is still meaningfully above zero so the
      // decay animates smoothly. Below the quantization threshold we can stop.
      if (q > 0) {
        rafId = window.requestAnimationFrame(tick)
      }
    }

    const onUpdate = () => {
      trackerRef.current.bump()
      if (rafId === null) {
        rafId = window.requestAnimationFrame(tick)
      }
    }

    editor.on('update', onUpdate)
    // Snapshot the target at effect-setup time so cleanup operates on the
    // same DOM node we wrote to, not whatever the ref points at after unmount.
    const elAtSetup = targetRef.current

    return () => {
      editor.off('update', onUpdate)
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (elAtSetup) elAtSetup.style.removeProperty('--warmth')
    }
  }, [editor, targetRef])
}
