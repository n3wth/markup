import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..', '..')
const scriptPath = resolve(repoRoot, 'scripts', 'orchestration-resume-dry-run.mjs')

function runScript() {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  })
}

describe('orchestration resume dry-run', () => {
  it('exits 0 and prints a resume summary', () => {
    const result = runScript()
    expect(result.error).toBeUndefined()
    expect(result.status, `stderr: ${result.stderr}`).toBe(0)

    const stdout = result.stdout
    expect(stdout).toContain('orchestration resume dry-run OK')
    expect(stdout).toMatch(
      /Summary: Last event: .+, pending tasks: \d+, in_flight: \d+, in_review: \d+, merged: \d+, rejected: \d+, hot files: \[.*\]/,
    )
    expect(stdout).toContain('Recent events:')
  })
})
