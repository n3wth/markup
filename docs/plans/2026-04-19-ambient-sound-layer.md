## Plan: Ambient Sound Layer

**Date:** 2026-04-19
**Status:** Proposal
**Issue:** W1-T039 (mk-guj)

### Goal

Give the workspace a subtle, always-optional audio voice. When several agents are acting and a co-author is typing on another document, the room should feel alive without ever being noisy. Every sound ships muted by default, is gated by an explicit user preference, and never interrupts an active model call or a focused writing moment.

The layer is decorative, not functional. A user who never enables audio must lose no information. Everything that makes a sound must also surface through an existing visual channel — cursors, the activity bar, chat, or timeline.

### Sound vocabulary

The initial vocabulary is small on purpose. Four cues, each with a clear trigger, clear meaning, and a variant per actor where it matters.

- **Keystroke** — short, soft, pitched per agent. Fires when an agent is mid-typing in the editor (not when a human types — humans already hear their own keyboard). Rate-limited so a burst of inserts does not produce a machine-gun.
- **Arrival chime** — a single gentle tone when a new human joins the session. Fires once per join, debounced against reconnects.
- **Completion click** — a short satisfying click when a checklist item flips to done, when an agent closes out a turn cleanly, or when a major action (replace, insert) commits to the doc.
- **Ambient hum** — a very low continuous bed that fades in when two or more agents are active and fades out when the session goes quiet. Gives the room a floor tone without pulling attention.

Cues outside this set (errors, warnings, chat messages) should stay silent in v1. Adding more requires a design review — the point of this layer is restraint.

### Spatial audio

When more than one agent is acting, the four cues should be panned per actor so the user can hear *where* the workspace is humming. The mapping is assigned when an agent joins and held stable for the life of the session:

- first agent: center
- second agent: left (pan -0.5)
- third agent: right (pan +0.5)
- fourth agent: slight rear (via reverb send, same center channel)

This should use `StereoPannerNode` on the agent's per-voice bus, not HRTF. Real spatial audio is overkill for a 2D text surface and costs far more CPU. The panning mirrors the visible cursor positioning in the activity bar so the audio and visual maps match.

Human co-authors do not get a pan slot. Their arrival chime is always center so the audio does not imply they are "an agent."

### Default mute and settings

The layer ships **off**. First-run users should never hear anything. The master toggle lives in user settings alongside the existing Gemini API key field:

```ts
export interface UserSettings {
  gemini_api_key: string | null
  ambient_audio: {
    enabled: boolean          // master mute, default false
    volume: number            // 0..1, default 0.3
    cues: {
      keystrokes: boolean     // default true (only matters if enabled)
      arrival_chime: boolean  // default true
      completion_click: boolean // default true
      ambient_hum: boolean    // default false — opt-in even inside opt-in
    }
    spatial: boolean          // default true when enabled
  }
}
```

The ambient hum stays opt-in twice because it is the one cue that can become tiring over a long session. Power users who want it can turn it on explicitly; nobody gets surprised by continuous tone.

The settings row should reuse the existing `user_settings` table (`src/lib/settings-store.ts`) with a single `ambient_audio` jsonb column. That keeps the schema change to one migration and avoids a new table for a feature most users will never touch.

### Module shape

The layer should live in `src/lib/ambient-audio/` as a small self-contained module with a narrow public surface:

```ts
// src/lib/ambient-audio/index.ts
export function createAmbientAudio(settings: AmbientAudioSettings): AmbientAudio
export interface AmbientAudio {
  setEnabled(on: boolean): void
  setVolume(v: number): void
  assignAgent(agentId: string, color: string): void
  releaseAgent(agentId: string): void
  cue(event: AudioCue): void
  destroy(): void
}
export type AudioCue =
  | { type: 'keystroke'; agentId: string }
  | { type: 'arrival'; who: 'human' | 'agent'; agentId?: string }
  | { type: 'completion'; agentId?: string }
  | { type: 'hum'; active: boolean }
```

Internals:

- **`AudioContext`** created lazily on first `cue()` call after `enabled=true`, never at import time. Browsers require a user gesture to unlock audio — the first toggle click satisfies that.
- **`GainNode` master bus** at the top, so `setEnabled(false)` ramps to 0 in ~50ms rather than hard-muting (prevents clicks).
- **Per-agent sub-bus** (`GainNode` → `StereoPannerNode` → master). Created on `assignAgent`, torn down on `releaseAgent`.
- **Keystroke rate-limiter** — drops cues when the last keystroke for that agent was <40ms ago.
- **Pre-decoded buffers** for arrival and completion (small WAV files in `public/sounds/`).
- **Synthesized keystrokes** via a short `OscillatorNode` + noise burst rather than samples. Lets us pitch per agent without shipping 4 variants of the same file.
- **Ambient hum** via a pair of detuned sine oscillators into a lowpass filter, gated by whether ≥2 agents are currently in the "thinking" or "typing" state.

No third-party audio library. The Web Audio API is enough for this scope and avoids another dependency in the bundle.

### Wiring points

The audio module subscribes to existing signals rather than introducing new ones:

- **Keystrokes** — `agent-actions.ts` already drives the per-character typing animation. Emit a cue from the same loop that inserts each character, gated by the rate-limiter.
- **Arrival** — the Supabase Realtime presence channel in `App.tsx` already fires join/leave events for multi-human sessions. Hook the join event.
- **Completion** — the orchestrator emits a turn-complete signal today. Tap that, plus the editor's checklist toggle transaction.
- **Hum active/inactive** — derived from the orchestrator's agent activity state. Fade in when `count(agents in non-idle) >= 2`, fade out otherwise, with a 2s hold to avoid flicker.

Each integration point should be a single-line call into `ambientAudio.cue(...)`, not a tangle of conditionals. The module swallows cues itself when disabled.

### Accessibility and respect

- **Respect `prefers-reduced-motion`** as a soft signal. If set, the layer should default ambient hum to off even when the user opts in globally, and halve the keystroke volume.
- **Never block the main thread.** All scheduling uses `AudioContext.currentTime`, not `setTimeout`. A slow render tick should never delay or misfire a cue.
- **Tab-blur behavior.** When the tab loses focus, ramp master gain to 0 over 200ms and suspend the `AudioContext`. Resume on focus. This avoids background tabs humming.
- **Headphones assumption.** Spatial audio is designed for headphones but tolerable on laptop speakers because the pan is gentle (±0.5, never ±1.0).

### What this is not

- **Not a notification system.** Errors, rate-limit warnings, and chat messages stay silent. Those belong in toasts and the activity bar.
- **Not voice.** Agents do not speak. Text-to-speech is a separate, much larger design.
- **Not music.** The ambient hum is a tone bed, not a soundtrack.
- **Not persistent across tabs.** Each open tab has its own `AudioContext`. Two tabs will hum twice. Acceptable for v1; revisit if it becomes annoying.

### Rollout

Phase 1: ship the module, the settings column, the settings UI row, and the four cues. Keep ambient hum behind a second opt-in inside the opt-in. Default everyone off.

Phase 2: add per-agent pitch customization and a "sound pack" concept if user feedback asks for it. Not before.

Phase 3 (speculative): surface audio as an affordance during onboarding — one explicit "Try sound" button on the home dashboard that plays a 3-second preview so users know the feature exists without hearing it unannounced.

### Open questions

- Should the completion click fire on *every* agent action commit, or only on user-initiated actions? Too-frequent clicks risk becoming a fidget sound. Default to only commit-on-user-ask; revisit with telemetry.
- Should spatial panning follow the cursor position within the activity bar (dynamic) or the join-order slot (static)? Static is simpler and avoids pans that "move" mid-turn. Recommend static for v1.
- What happens in a session with 5+ agents? The agent cap is 4 today (`AgentConfigurator.tsx`), so this is moot in v1. If the cap lifts, we need more pan slots or a slot-recycling policy.
