import { useEffect, useRef, memo } from 'react'
import { createNoise3D } from 'simplex-noise'

type BlobState = 'idle' | 'thinking' | 'reading' | 'typing' | 'editing' | 'logo'

/**
 * A mood modulates the avatar's animation independently of its state. When
 * omitted, mood is derived from state: thinking → pulse, typing/editing →
 * shimmer, idle → breath, everything else → none. Callers (e.g. the
 * hover card or header) can override to reflect stance or reaction signals
 * that don't map cleanly to the state machine.
 */
export type BlobMood = 'pulse' | 'shimmer' | 'breath' | 'none'

const AGENT_COLORS: Record<string, string> = {
  Aiden: '#30d158',
  Nova: '#ff6961',
  Lex: '#64d2ff',
  Mira: '#ffd60a',
}

interface BlobAvatarProps {
  name: string
  size?: number
  state?: BlobState
  color?: string
  /** Optional mood override. Defaults to a value derived from `state`. */
  mood?: BlobMood
  /**
   * 0..1 self-assessed confidence from AgentStance. Lower values morph the
   * blob toward a slightly more distorted shape (hesitant); higher values
   * smooth it. Defaults to 1 (fully certain) — no visual change.
   */
  confidence?: number
}

const SEEDS: Record<string, number> = { Aiden: 1, Nova: 2, Lex: 3, Mira: 4 }

// Speed, distortion, breath, and fill targets per state
const STATE_CONFIG: Record<BlobState, { speed: number, distort: number, breath: number, fill: number }> = {
  idle:     { speed: 0.18, distort: 0.05,  breath: 0.012, fill: 0 },
  thinking: { speed: 0.55, distort: 0.11,  breath: 0.02,  fill: 0.55 },
  reading:  { speed: 0.30, distort: 0.08,  breath: 0.018, fill: 0.35 },
  typing:   { speed: 0.90, distort: 0.15,  breath: 0.008, fill: 1 },
  editing:  { speed: 0.90, distort: 0.15,  breath: 0.008, fill: 1 },
  logo:     { speed: 0.15, distort: 0.04,  breath: 0.008, fill: 1 },
}

const REF_SIZE = 28
const POINTS = 6

// Pre-compute angle constants
const ANGLES = Array.from({ length: POINTS }, (_, i) => (Math.PI * 2 * i) / POINTS)
const COS_ANGLES = ANGLES.map(Math.cos)
const SIN_ANGLES = ANGLES.map(Math.sin)

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

function deriveMood(state: BlobState): BlobMood {
  switch (state) {
    case 'thinking': return 'pulse'
    case 'typing': case 'editing': return 'shimmer'
    case 'idle': return 'breath'
    default: return 'none'
  }
}

export const BlobAvatar = memo(({ name, size = 28, state = 'idle', color, mood, confidence = 1 }: BlobAvatarProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const stateRef = useRef(state)
  const moodRef = useRef<BlobMood>(mood ?? deriveMood(state))
  const confidenceRef = useRef(confidence)
  const fillRef = useRef(STATE_CONFIG[state].fill)
  useEffect(() => { stateRef.current = state })
  useEffect(() => { moodRef.current = mood ?? deriveMood(state) }, [mood, state])
  useEffect(() => { confidenceRef.current = Math.max(0, Math.min(1, confidence)) }, [confidence])

  const seed = SEEDS[name] ?? (name.charCodeAt(0) % 10)
  const agentColor = color || AGENT_COLORS[name] || '#1a1a1a'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctxOrNull = canvas.getContext('2d', { alpha: true })
    if (!ctxOrNull) return
    const ctx = ctxOrNull

    const noise3D = createNoise3D()
    const [cr, cg, cb] = hexToRgb(agentColor)

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    let t = Math.random() * 50 // offset so blobs don't sync
    let lastFrame = 0
    const cx = size / 2
    const cy = size / 2
    const r = size * 0.34
    const strokeW = Math.max(size * 0.06, 1.2)

    // Reusable arrays to avoid GC pressure
    const ptsX = new Float32Array(POINTS)
    const ptsY = new Float32Array(POINTS)

    function computeBlob(time: number, distort: number, breath: number) {
      const scale = 1 + Math.sin(time * 0.8) * breath
      for (let i = 0; i < POINTS; i++) {
        const n = noise3D(COS_ANGLES[i] + seed, SIN_ANGLES[i] + seed, time)
        const rad = r * scale * (1 + n * distort)
        ptsX[i] = cx + COS_ANGLES[i] * rad
        ptsY[i] = cy + SIN_ANGLES[i] * rad
      }
    }

    function drawBlobPath(context: CanvasRenderingContext2D) {
      context.beginPath()
      for (let i = 0; i < POINTS; i++) {
        const p0x = ptsX[(i - 1 + POINTS) % POINTS], p0y = ptsY[(i - 1 + POINTS) % POINTS]
        const p1x = ptsX[i], p1y = ptsY[i]
        const p2x = ptsX[(i + 1) % POINTS], p2y = ptsY[(i + 1) % POINTS]
        const p3x = ptsX[(i + 2) % POINTS], p3y = ptsY[(i + 2) % POINTS]

        const cp1x = p1x + (p2x - p0x) / 6
        const cp1y = p1y + (p2y - p0y) / 6
        const cp2x = p2x - (p3x - p1x) / 6
        const cp2y = p2y - (p3y - p1y) / 6

        if (i === 0) context.moveTo(p1x, p1y)
        context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2x, p2y)
      }
      context.closePath()
    }

    function draw(now: number) {
      const s = stateRef.current
      const m = moodRef.current
      const conf = confidenceRef.current
      const isActive = s !== 'idle'
      const isMoodAnimated = m === 'pulse' || m === 'shimmer' || (m === 'breath' && s === 'idle')
      const isTransitioning = Math.abs(fillRef.current - STATE_CONFIG[s].fill) > 0.005

      // Throttle idle to ~4fps, but keep full fps during fill transitions and
      // when an active mood is driving its own animation.
      if (!isActive && !isTransitioning && !isMoodAnimated && now - lastFrame < 250) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0.016
      lastFrame = now

      const cfg = STATE_CONFIG[s]
      const sizeScale = REF_SIZE / size

      // Smooth fill transition
      const target = cfg.fill
      const diff = target - fillRef.current
      if (Math.abs(diff) < 0.003) {
        fillRef.current = target
      } else if (diff > 0) {
        // Rising: exponential lerp (fast start, eases in)
        fillRef.current += diff * Math.min(4.0 * dt, 0.15)
      } else {
        // Draining: constant speed (linear, smooth)
        fillRef.current = Math.max(target, fillRef.current - 0.6 * dt)
      }
      const fill = fillRef.current

      t += dt * cfg.speed * sizeScale
      ctx.clearRect(0, 0, size, size)

      // Confidence morph: lower confidence adds extra distortion to the blob
      // shape (hesitant), higher smooths it. Clamped so max extra is ~+60%.
      const confDistort = cfg.distort * (1 + (1 - conf) * 0.6)
      // Breath mood slows the idle breath rhythm; other moods leave it alone.
      const moodBreath = m === 'breath' ? cfg.breath * 0.6 : cfg.breath
      computeBlob(t, confDistort, moodBreath)

      // 1. Always draw outline. Pulse mood modulates stroke width in a slow,
      // steady ~1.2Hz rhythm — "thinking" as a breathing edge.
      const pulseMul = m === 'pulse'
        ? 1 + Math.sin(now * 0.0075) * 0.18
        : 1
      drawBlobPath(ctx)
      ctx.strokeStyle = agentColor
      ctx.lineWidth = strokeW * pulseMul
      ctx.stroke()

      // 2. Draw water fill if > 0
      if (fill > 0.005) {
        ctx.save()
        drawBlobPath(ctx)
        ctx.clip()

        // Water line position — from bottom to top
        const blobTop = cy - r * 1.15
        const blobBottom = cy + r * 1.15
        const waterY = blobBottom - fill * (blobBottom - blobTop)

        // Wobbling water surface
        const wobbleAmp = size * 0.035 * Math.min(fill * 2, 1)
        const wobblePhase = t * 2.2

        ctx.beginPath()
        const left = cx - r * 1.3
        const right = cx + r * 1.3

        ctx.moveTo(left, waterY)
        // Draw wave in steps of 2px for smooth but efficient curve
        const step = Math.max(2, size / 20)
        for (let x = left; x <= right; x += step) {
          const wave = Math.sin((x / size) * 3 * Math.PI + wobblePhase) * wobbleAmp
          ctx.lineTo(x, waterY + wave)
        }
        ctx.lineTo(right, waterY + Math.sin((right / size) * 3 * Math.PI + wobblePhase) * wobbleAmp)
        ctx.lineTo(right, blobBottom + r)
        ctx.lineTo(left, blobBottom + r)
        ctx.closePath()

        // Fill opacity scales with level
        const alpha = 0.2 + fill * 0.8
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`
        ctx.fill()

        // Shimmer when >40% full. Shimmer mood orbits the highlight faster
        // and pulses its intensity — reads as "excited about an idea".
        if (fill > 0.4) {
          const shimSpeed = m === 'shimmer' ? 2.0 : 0.7
          const shimBoost = m === 'shimmer'
            ? 1 + Math.sin(now * 0.012) * 0.35
            : 1
          const shimAngle = (t * shimSpeed) % (Math.PI * 2)
          const hx = cx + Math.cos(shimAngle) * r * 0.4
          const hy = cy + Math.sin(shimAngle) * r * 0.4
          const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.7)
          glow.addColorStop(0, `rgba(255,255,255,${0.3 * fill * shimBoost})`)
          glow.addColorStop(0.5, `rgba(255,255,255,${0.08 * fill * shimBoost})`)
          glow.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = glow
          ctx.fill()
        }

        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [size, seed, agentColor])

  return (
    <div className="blob-avatar-wrap" data-tooltip={state === 'idle' ? name : `${name} — ${state}`}>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, flexShrink: 0, display: 'block' }}
      />
    </div>
  )
})
