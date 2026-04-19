import { describe, it, expect, vi } from 'vitest'
import { createEditorLockCoordinator } from '../orchestrator/editor-lock'

describe('createEditorLockCoordinator', () => {
  describe('lock state', () => {
    it('starts unlocked with a null holder', () => {
      const lock = createEditorLockCoordinator()
      expect(lock.isLocked()).toBe(false)
      expect(lock.lockHolder()).toBeNull()
    })

    it('reports locked when the ref carries an agent name', () => {
      const ref = { current: null as string | null }
      const lock = createEditorLockCoordinator(ref)
      ref.current = 'Aiden'
      expect(lock.isLocked()).toBe(true)
      expect(lock.lockHolder()).toBe('Aiden')
    })

    it('returns the same ref instance on every getRef() call', () => {
      const ref = { current: null as string | null }
      const lock = createEditorLockCoordinator(ref)
      expect(lock.getRef()).toBe(ref)
      expect(lock.getRef()).toBe(lock.getRef())
    })

    it('allocates an internal ref when none is supplied', () => {
      const lock = createEditorLockCoordinator()
      const ref = lock.getRef()
      expect(ref).toEqual({ current: null })
      ref.current = 'Nova'
      expect(lock.lockHolder()).toBe('Nova')
    })
  })

  describe('waitForUnlock', () => {
    it('resolves immediately when the lock is free', async () => {
      const lock = createEditorLockCoordinator()
      await expect(lock.waitForUnlock()).resolves.toBeUndefined()
    })

    it('defers resolution until the lock is released via runQueued', async () => {
      const ref = { current: 'Aiden' as string | null }
      const lock = createEditorLockCoordinator(ref)
      const resolved = vi.fn()
      const p = lock.waitForUnlock().then(resolved)

      // Still locked — no resolution yet
      await Promise.resolve()
      expect(resolved).not.toHaveBeenCalled()

      ref.current = null
      lock.runQueued()
      await p
      expect(resolved).toHaveBeenCalledOnce()
    })

    it('resolves every concurrent waiter on a single release', async () => {
      const ref = { current: 'Aiden' as string | null }
      const lock = createEditorLockCoordinator(ref)
      const a = lock.waitForUnlock()
      const b = lock.waitForUnlock()
      const c = lock.waitForUnlock()

      ref.current = null
      lock.runQueued()

      await expect(Promise.all([a, b, c])).resolves.toEqual([undefined, undefined, undefined])
    })
  })

  describe('enqueueWhenUnlocked', () => {
    it('runs the action synchronously when the lock is free', () => {
      const lock = createEditorLockCoordinator()
      const action = vi.fn()
      lock.enqueueWhenUnlocked(action)
      expect(action).toHaveBeenCalledOnce()
    })

    it('holds the action while locked and fires it on runQueued', () => {
      const ref = { current: 'Aiden' as string | null }
      const lock = createEditorLockCoordinator(ref)
      const action = vi.fn()
      lock.enqueueWhenUnlocked(action)
      expect(action).not.toHaveBeenCalled()

      ref.current = null
      lock.runQueued()
      expect(action).toHaveBeenCalledOnce()
    })

    it('drains queued actions in FIFO order', () => {
      const ref = { current: 'Aiden' as string | null }
      const lock = createEditorLockCoordinator(ref)
      const calls: string[] = []
      lock.enqueueWhenUnlocked(() => calls.push('first'))
      lock.enqueueWhenUnlocked(() => calls.push('second'))
      lock.enqueueWhenUnlocked(() => calls.push('third'))

      ref.current = null
      lock.runQueued()
      expect(calls).toEqual(['first', 'second', 'third'])
    })

    it('defers work enqueued from inside a callback to the next drain', () => {
      const ref = { current: 'Aiden' as string | null }
      const lock = createEditorLockCoordinator(ref)
      const calls: string[] = []

      lock.enqueueWhenUnlocked(() => {
        calls.push('first')
        // Re-acquire the lock mid-drain (simulating agent-actions holding it)
        ref.current = 'Nova'
        lock.enqueueWhenUnlocked(() => calls.push('nested'))
      })

      ref.current = null
      lock.runQueued()
      expect(calls).toEqual(['first'])

      // Release the second lock and drain again
      ref.current = null
      lock.runQueued()
      expect(calls).toEqual(['first', 'nested'])
    })
  })

  describe('runQueued', () => {
    it('is a no-op when nothing is queued', () => {
      const lock = createEditorLockCoordinator()
      expect(() => lock.runQueued()).not.toThrow()
    })

    it('resolves waiters and fires callbacks on the same release', async () => {
      const ref = { current: 'Aiden' as string | null }
      const lock = createEditorLockCoordinator(ref)
      const events: string[] = []

      const waited = lock.waitForUnlock().then(() => events.push('waiter'))
      lock.enqueueWhenUnlocked(() => events.push('callback'))

      ref.current = null
      lock.runQueued()
      await waited

      expect(events).toContain('waiter')
      expect(events).toContain('callback')
      expect(events).toHaveLength(2)
    })
  })

  describe('destroy', () => {
    it('clears the ref', () => {
      const ref = { current: 'Aiden' as string | null }
      const lock = createEditorLockCoordinator(ref)
      lock.destroy()
      expect(ref.current).toBeNull()
      expect(lock.isLocked()).toBe(false)
    })

    it('drops pending callbacks so they never fire', () => {
      const ref = { current: 'Aiden' as string | null }
      const lock = createEditorLockCoordinator(ref)
      const action = vi.fn()
      lock.enqueueWhenUnlocked(action)

      lock.destroy()
      lock.runQueued()
      expect(action).not.toHaveBeenCalled()
    })

    it('resolves any outstanding waiters so awaiters unblock', async () => {
      const ref = { current: 'Aiden' as string | null }
      const lock = createEditorLockCoordinator(ref)
      const p = lock.waitForUnlock()
      lock.destroy()
      await expect(p).resolves.toBeUndefined()
    })
  })
})
