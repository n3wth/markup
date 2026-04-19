import { describe, it, expect, beforeEach } from 'vitest'
import {
  noteRemoteEdit,
  isSimultaneousEdit,
  getLastRemoteEditAt,
  clearRemoteEditHistory,
  _resetConflictDetector,
  SIMULTANEOUS_EDIT_WINDOW_MS,
} from '../lib/conflict-detector'

beforeEach(() => {
  _resetConflictDetector()
})

describe('noteRemoteEdit / getLastRemoteEditAt', () => {
  it('records and returns the most recent remote-edit timestamp per session', () => {
    noteRemoteEdit('s1', 1000)
    noteRemoteEdit('s2', 2000)
    expect(getLastRemoteEditAt('s1')).toBe(1000)
    expect(getLastRemoteEditAt('s2')).toBe(2000)
  })

  it('overwrites the previous timestamp on a later note', () => {
    noteRemoteEdit('s1', 1000)
    noteRemoteEdit('s1', 1500)
    expect(getLastRemoteEditAt('s1')).toBe(1500)
  })

  it('returns undefined for an unseen session', () => {
    expect(getLastRemoteEditAt('never-seen')).toBeUndefined()
  })

  it('defaults the timestamp to Date.now()', () => {
    const before = Date.now()
    noteRemoteEdit('s1')
    const after = Date.now()
    const recorded = getLastRemoteEditAt('s1')
    expect(recorded).toBeDefined()
    expect(recorded!).toBeGreaterThanOrEqual(before)
    expect(recorded!).toBeLessThanOrEqual(after)
  })
})

describe('isSimultaneousEdit', () => {
  it('returns false when no remote edit has been recorded', () => {
    expect(isSimultaneousEdit('s1', 1000)).toBe(false)
  })

  it('returns true when a remote edit landed strictly inside the window', () => {
    noteRemoteEdit('s1', 1000)
    // 1.5s later — well inside the 2s window
    expect(isSimultaneousEdit('s1', 2500)).toBe(true)
  })

  it('returns true at the moment the remote edit arrived', () => {
    noteRemoteEdit('s1', 1000)
    expect(isSimultaneousEdit('s1', 1000)).toBe(true)
  })

  it('returns false at the exact window boundary (window is exclusive)', () => {
    noteRemoteEdit('s1', 1000)
    expect(isSimultaneousEdit('s1', 1000 + SIMULTANEOUS_EDIT_WINDOW_MS)).toBe(false)
  })

  it('returns false once the window has elapsed', () => {
    noteRemoteEdit('s1', 1000)
    expect(isSimultaneousEdit('s1', 5000)).toBe(false)
  })

  it('honors a caller-supplied window override', () => {
    noteRemoteEdit('s1', 1000)
    expect(isSimultaneousEdit('s1', 1500, 400)).toBe(false)
    expect(isSimultaneousEdit('s1', 1300, 400)).toBe(true)
  })

  it('isolates state per session id', () => {
    noteRemoteEdit('s1', 1000)
    expect(isSimultaneousEdit('s2', 1500)).toBe(false)
  })
})

describe('clearRemoteEditHistory', () => {
  it('drops the recorded timestamp so subsequent checks return false', () => {
    noteRemoteEdit('s1', 1000)
    clearRemoteEditHistory('s1')
    expect(getLastRemoteEditAt('s1')).toBeUndefined()
    expect(isSimultaneousEdit('s1', 1500)).toBe(false)
  })

  it('only clears the named session', () => {
    noteRemoteEdit('s1', 1000)
    noteRemoteEdit('s2', 1000)
    clearRemoteEditHistory('s1')
    expect(getLastRemoteEditAt('s1')).toBeUndefined()
    expect(getLastRemoteEditAt('s2')).toBe(1000)
  })

  it('no-ops on an unknown session id', () => {
    expect(() => clearRemoteEditHistory('never-seen')).not.toThrow()
  })
})

describe('SIMULTANEOUS_EDIT_WINDOW_MS', () => {
  it('matches the W1-T018 spec of 2 seconds', () => {
    expect(SIMULTANEOUS_EDIT_WINDOW_MS).toBe(2000)
  })
})
