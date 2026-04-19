#!/usr/bin/env node
/**
 * Orchestrator RESTART dry-run validator (W0-T016).
 *
 * Purpose: prove a successor orchestrator can reconstruct full state from
 * the on-disk orchestration files alone — no hidden state. If this script
 * exits non-zero, the restart protocol is broken and the orchestrator
 * cannot be safely resumed.
 *
 * Reads (but never mutates):
 *   orchestration/state.md
 *   orchestration/queue.json
 *   orchestration/plan.md
 *   orchestration/README.md
 *   orchestration/pr-protocol.md
 *   orchestration/runners.md
 *   orchestration/decisions.md
 *   orchestration/teams.md
 *
 * Validates:
 *   - every file exists and is non-empty
 *   - queue.json parses, has required top-level buckets, each task has
 *     id/wave/track/team/module/blocked_by/desc, ids are unique, hot_files
 *     is an array
 *   - state.md has at least one event header
 *
 * Emits a successor-resume summary on stdout.
 */

import { readFile, stat } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const orchDir = join(repoRoot, 'orchestration')

const REQUIRED_FILES = [
  'state.md',
  'queue.json',
  'plan.md',
  'README.md',
  'pr-protocol.md',
  'runners.md',
  'decisions.md',
  'teams.md',
]

const REQUIRED_TASK_FIELDS = [
  'id',
  'wave',
  'track',
  'team',
  'module',
  'blocked_by',
  'desc',
]

const REQUIRED_QUEUE_BUCKETS = [
  'pending',
  'in_flight',
  'in_review',
  'merged',
  'rejected',
]

const errors = []

function fail(msg) {
  errors.push(msg)
}

async function assertNonEmptyFile(relPath) {
  const abs = join(orchDir, relPath)
  try {
    const info = await stat(abs)
    if (!info.isFile()) {
      fail(`${relPath} is not a regular file`)
      return null
    }
    if (info.size === 0) {
      fail(`${relPath} is empty`)
      return null
    }
    const content = await readFile(abs, 'utf8')
    if (content.trim().length === 0) {
      fail(`${relPath} has only whitespace`)
      return null
    }
    return content
  } catch (err) {
    fail(`${relPath} missing or unreadable: ${err.message}`)
    return null
  }
}

function validateQueue(raw) {
  let queue
  try {
    queue = JSON.parse(raw)
  } catch (err) {
    fail(`queue.json is not valid JSON: ${err.message}`)
    return null
  }

  if (!queue || typeof queue !== 'object' || Array.isArray(queue)) {
    fail('queue.json root must be an object')
    return null
  }

  if (!Array.isArray(queue.hot_files)) {
    fail('queue.json: hot_files must be an array')
  }

  for (const bucket of REQUIRED_QUEUE_BUCKETS) {
    if (!Array.isArray(queue[bucket])) {
      fail(`queue.json: bucket "${bucket}" must be an array`)
    }
  }

  const seenIds = new Set()
  for (const bucket of REQUIRED_QUEUE_BUCKETS) {
    const tasks = Array.isArray(queue[bucket]) ? queue[bucket] : []
    tasks.forEach((task, idx) => {
      const location = `${bucket}[${idx}]`
      if (!task || typeof task !== 'object' || Array.isArray(task)) {
        fail(`queue.json: ${location} is not an object`)
        return
      }
      for (const field of REQUIRED_TASK_FIELDS) {
        if (!(field in task)) {
          fail(`queue.json: ${location} (${task.id ?? '?'}) missing field "${field}"`)
        }
      }
      if (task.blocked_by != null && !Array.isArray(task.blocked_by)) {
        fail(`queue.json: ${location} (${task.id ?? '?'}) blocked_by must be an array`)
      }
      if (typeof task.id === 'string' && task.id.length > 0) {
        if (seenIds.has(task.id)) {
          fail(`queue.json: duplicate task id "${task.id}"`)
        }
        seenIds.add(task.id)
      } else {
        fail(`queue.json: ${location} has non-string/empty id`)
      }
    })
  }

  return queue
}

/**
 * Parse `state.md` to extract event headers of the form:
 *   ## <timestamp> — <orchestrator-id> — <EVENT>
 * (separator is U+2014 em dash). The template line containing
 * `<ISO timestamp>` placeholders is skipped. Returns the last N in
 * file order.
 */
function extractEvents(stateMd, limit = 5) {
  const events = []
  const lines = stateMd.split(/\r?\n/)
  const isoTs = /^\d{4}-\d{2}-\d{2}T/
  for (const line of lines) {
    if (!line.startsWith('## ')) continue
    const rest = line.slice(3).trim()
    const parts = rest.split(/\s+[—-]\s+/)
    if (parts.length < 3) continue
    const [timestamp, orchestrator, ...eventParts] = parts
    if (!isoTs.test(timestamp)) continue // skip header template
    events.push({
      timestamp: timestamp.trim(),
      orchestrator: orchestrator.trim(),
      event: eventParts.join(' - ').trim(),
    })
  }
  return events.slice(-limit)
}

async function main() {
  const contents = {}
  for (const name of REQUIRED_FILES) {
    contents[name] = await assertNonEmptyFile(name)
  }

  const queue = contents['queue.json']
    ? validateQueue(contents['queue.json'])
    : null

  const recentEvents = contents['state.md']
    ? extractEvents(contents['state.md'], 5)
    : []

  if (contents['state.md'] && recentEvents.length === 0) {
    fail('state.md has no parseable event headers')
  }

  if (errors.length > 0) {
    console.error('orchestration resume dry-run FAILED:')
    for (const err of errors) console.error(`  - ${err}`)
    process.exit(1)
  }

  const counts = {
    pending: queue.pending.length,
    in_flight: queue.in_flight.length,
    in_review: queue.in_review.length,
    merged: queue.merged.length,
    rejected: queue.rejected.length,
  }
  const last = recentEvents[recentEvents.length - 1]
  const lastEventStr = last
    ? `${last.timestamp} ${last.orchestrator} ${last.event}`
    : '<none>'
  const hotFiles = Array.isArray(queue.hot_files) ? queue.hot_files : []

  console.log('orchestration resume dry-run OK')
  console.log(
    `Summary: Last event: ${lastEventStr}, pending tasks: ${counts.pending}, ` +
    `in_flight: ${counts.in_flight}, in_review: ${counts.in_review}, ` +
    `merged: ${counts.merged}, rejected: ${counts.rejected}, ` +
    `hot files: [${hotFiles.join(', ')}]`,
  )
  console.log('Recent events:')
  for (const ev of recentEvents) {
    console.log(`  ${ev.timestamp}  ${ev.orchestrator}  ${ev.event}`)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(`orchestration resume dry-run CRASHED: ${err.stack ?? err.message}`)
  process.exit(2)
})
