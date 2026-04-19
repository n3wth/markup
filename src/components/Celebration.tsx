import { useEffect, useRef } from 'react'
import { CELEBRATION_LABELS, type CelebrationKind } from '../celebrations'

interface CelebrationProps {
  kind: CelebrationKind | null
  colors: string[]
  onDone: () => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vrot: number
  size: number
  color: string
  shape: 'rect' | 'circle'
}

const PARTICLE_COUNT = 80
const GRAVITY = 0.18
const DRAG = 0.992
const DURATION_MS = 2200
const BANNER_FADE_MS = 1800

function makeParticles(width: number, height: number, colors: string[]): Particle[] {
  const particles: Particle[] = []
  const palette = colors.length > 0 ? colors : ['#30d158', '#ff6961', '#64d2ff', '#ffd60a']
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9
    const speed = 6 + Math.random() * 6
    particles.push({
      x: width / 2 + (Math.random() - 0.5) * width * 0.35,
      y: height * 0.55 + (Math.random() - 0.5) * 30,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 2,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.3,
      size: 4 + Math.random() * 4,
      color: palette[i % palette.length],
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    })
  }
  return particles
}

export function Celebration({ kind, colors, onDone }: CelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bannerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!kind) return

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    // Defer adding the visible class so the initial 0-opacity frame is
    // committed first — that's what makes the CSS transition run.
    const showBanner = window.setTimeout(() => {
      bannerRef.current?.classList.add('celebration-banner--visible')
    }, 16)

    if (reduceMotion) {
      const fade = window.setTimeout(() => {
        bannerRef.current?.classList.remove('celebration-banner--visible')
      }, BANNER_FADE_MS)
      const finish = window.setTimeout(onDone, BANNER_FADE_MS + 250)
      return () => {
        clearTimeout(showBanner)
        clearTimeout(fade)
        clearTimeout(finish)
      }
    }

    const canvas = canvasRef.current
    if (!canvas) {
      const finish = window.setTimeout(onDone, DURATION_MS)
      return () => { clearTimeout(showBanner); clearTimeout(finish) }
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      const finish = window.setTimeout(onDone, DURATION_MS)
      return () => { clearTimeout(showBanner); clearTimeout(finish) }
    }

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const particles = makeParticles(rect.width, rect.height, colors)
    const start = performance.now()

    const tick = (now: number) => {
      const elapsed = now - start
      ctx.clearRect(0, 0, rect.width, rect.height)
      const lifeLeft = Math.max(0, 1 - elapsed / DURATION_MS)

      for (const p of particles) {
        p.vx *= DRAG
        p.vy = p.vy * DRAG + GRAVITY
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vrot

        ctx.save()
        ctx.globalAlpha = lifeLeft
        ctx.fillStyle = p.color
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      if (elapsed < DURATION_MS) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height)
        bannerRef.current?.classList.remove('celebration-banner--visible')
        window.setTimeout(onDone, 300)
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(showBanner)
      ctx.clearRect(0, 0, rect.width, rect.height)
    }
  }, [kind, colors, onDone])

  if (!kind) return null
  const label = CELEBRATION_LABELS[kind]

  return (
    <div className="celebration-overlay" aria-live="polite" aria-atomic="true">
      <canvas ref={canvasRef} className="celebration-canvas" />
      <div ref={bannerRef} className="celebration-banner">
        <span className="celebration-banner-title">{label.title}</span>
        <span className="celebration-banner-detail">{label.detail}</span>
      </div>
    </div>
  )
}
