/**
 * Editor lock coordinator.
 *
 * The Tiptap editor can only accept one writer at a time (insert/replace/image
 * mutations walk the ProseMirror state in character-by-character passes). The
 * orchestrator and `agent-actions.ts` share a single mutable ref —
 * `{ current: string | null }` — that names the agent currently holding the
 * editor. While locked, other agents must either wait or defer their work.
 *
 * This module encapsulates that ref plus a small hold/release surface:
 *
 * - `isLocked()` / `lockHolder()` — read-only checks used when building prompts
 *   (so an agent knows whether a peer is mid-write).
 * - `waitForUnlock()` — promise that resolves when the ref goes back to null.
 * - `enqueueWhenUnlocked(action)` — queue a zero-arg callback to fire the next
 *   time the lock is free, in FIFO order.
 * - `runQueued()` — drain queued callbacks; safe to call when already unlocked.
 * - `destroy()` — drop pending callbacks and clear the ref.
 *
 * The ref itself stays exposed via `getRef()` because `executeAgentAction` and
 * `askAgent` still accept the raw object directly. Behavior is identical to
 * the prior inline implementation; this module purely centralizes access.
 *
 * Factory pattern mirrors `createTurnQueue` / `createRateLimiter` — each
 * orchestrator instance owns its own coordinator with closed-over state.
 */

export type EditorLockRef = { current: string | null }

export interface EditorLockCoordinator {
  /** The shared ref, passed to `executeAgentAction` and `askAgent`. */
  getRef(): EditorLockRef
  /** Current holder name, or null when the editor is free. */
  lockHolder(): string | null
  /** True when any agent currently holds the editor. */
  isLocked(): boolean
  /**
   * Resolves the next time the lock is free. Resolves immediately when already
   * unlocked. Multiple concurrent waiters all resolve on the same release.
   */
  waitForUnlock(): Promise<void>
  /**
   * Queue a zero-arg callback to run the next time the lock releases. When the
   * lock is already free, the callback is invoked synchronously. Callbacks
   * fire in FIFO order on `runQueued()`.
   */
  enqueueWhenUnlocked(action: () => void): void
  /**
   * Drain any queued callbacks. Safe to call while unlocked — intended to be
   * invoked by the lock holder after release. No-op when the queue is empty.
   */
  runQueued(): void
  /** Clear the ref, drop every pending callback/waiter. Used in destroy(). */
  destroy(): void
}

/**
 * Create a coordinator bound to an existing ref (when the orchestrator needs
 * to share a ref it already allocated) or to a fresh internal ref when none
 * is supplied. Passing the ref explicitly preserves reference identity for
 * callers that capture it (e.g. `executeAgentAction`).
 */
export function createEditorLockCoordinator(
  ref: EditorLockRef = { current: null },
): EditorLockCoordinator {
  const pending: Array<() => void> = []
  const waiters: Array<() => void> = []

  function drainWaiters() {
    const toResolve = waiters.splice(0, waiters.length)
    for (const resolve of toResolve) resolve()
  }

  return {
    getRef() {
      return ref
    },
    lockHolder() {
      return ref.current
    },
    isLocked() {
      return ref.current !== null
    },
    waitForUnlock() {
      if (ref.current === null) return Promise.resolve()
      return new Promise<void>((resolve) => {
        waiters.push(resolve)
      })
    },
    enqueueWhenUnlocked(action) {
      if (ref.current === null) {
        action()
        return
      }
      pending.push(action)
    },
    runQueued() {
      // Resolve any pending waiters first so awaiters observe the unlocked
      // state before queued callbacks potentially re-acquire the lock.
      drainWaiters()
      // Snapshot so callbacks that enqueue new work run on the next drain.
      const toRun = pending.splice(0, pending.length)
      for (const action of toRun) action()
    },
    destroy() {
      ref.current = null
      pending.length = 0
      drainWaiters()
    },
  }
}
