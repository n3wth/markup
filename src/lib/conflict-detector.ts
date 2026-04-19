/**
 * Simultaneous-edit detector for the snapshot-based document model.
 *
 * Conflict-resolution strategy in this codebase is **last-write-wins per
 * document node** (the document is the node — see `documents.html_snapshot`
 * in `supabase/migrations/001_initial_schema.sql`). The Supabase upsert in
 * `saveDocument` overwrites the row unconditionally, so the most recent
 * `saveDocument` call across all clients silently becomes the durable
 * truth. That keeps the data path simple but loses one client's edits when
 * two authors type at the same time.
 *
 * This module gives the UI a hook to warn when that happens. Callers note
 * incoming remote edits via `noteRemoteEdit(sessionId)` and then ask
 * `isSimultaneousEdit(sessionId)` right before persisting a local edit.
 * If a remote edit landed inside the warning window (default 2s), the
 * caller should surface a toast so the user knows their save likely
 * stomped a teammate's keystrokes.
 *
 * The module is intentionally side-effect free: no toasts, no React, no
 * Supabase. UI wiring happens in the editor hook and downstream tasks
 * (W1-T019 out-of-sync indicator, W1-T020 multi-author).
 */

const lastRemoteEditAt = new Map<string, number>()

/** Default warning window. Per spec W1-T018: warn on simultaneous edit within 2s. */
export const SIMULTANEOUS_EDIT_WINDOW_MS = 2000

/**
 * Record that a remote edit for `sessionId` has just been observed.
 * Call from the realtime subscriber when a doc-edit broadcast or a
 * `postgres_changes` row lands and is not equal to the local snapshot.
 */
export function noteRemoteEdit(sessionId: string, nowMs: number = Date.now()): void {
  lastRemoteEditAt.set(sessionId, nowMs)
}

/**
 * True when a remote edit for `sessionId` landed within `windowMs` of
 * `nowMs`. Read this just before saving a local edit; if it returns true
 * the caller should warn the user that their save raced an incoming edit
 * and likely overwrote it.
 */
export function isSimultaneousEdit(
  sessionId: string,
  nowMs: number = Date.now(),
  windowMs: number = SIMULTANEOUS_EDIT_WINDOW_MS,
): boolean {
  const last = lastRemoteEditAt.get(sessionId)
  if (last === undefined) return false
  return nowMs - last < windowMs
}

/**
 * Read-only accessor for the most recently observed remote-edit timestamp
 * for `sessionId`, or `undefined` if none has been recorded. Useful for
 * tests and for downstream out-of-sync indicators (W1-T019).
 */
export function getLastRemoteEditAt(sessionId: string): number | undefined {
  return lastRemoteEditAt.get(sessionId)
}

/**
 * Forget any remote-edit history for `sessionId`. Call on session switch
 * or unmount so a stale timestamp from a previous session can't trigger a
 * spurious warning in the next one.
 */
export function clearRemoteEditHistory(sessionId: string): void {
  lastRemoteEditAt.delete(sessionId)
}

/** Test-only: drop all tracked sessions. */
export function _resetConflictDetector(): void {
  lastRemoteEditAt.clear()
}
