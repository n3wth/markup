import { describe, it, expect, beforeEach } from 'vitest'
import {
  groupSessionsByProject,
  loadCollapsedProjects,
  saveCollapsedProjects,
  projectGroupId,
  projectGroupLabel,
  SYNTHETIC_INBOX_ID,
} from '../lib/project-tree'
import type { Project, Session } from '../types'

function project(id: string, title: string, archived = false): Project {
  return {
    id,
    user_id: 'u-1',
    title,
    archived_at: archived ? '2026-01-01T00:00:00Z' : null,
    created_at: '2026-04-01T00:00:00Z',
  }
}

function session(id: string, projectId: string | null, updated: string): Session {
  return {
    id,
    user_id: 'u-1',
    title: id,
    template: 'blank',
    project_id: projectId,
    created_at: updated,
    updated_at: updated,
  }
}

describe('groupSessionsByProject', () => {
  it('places each session under its project, in project order', () => {
    const projects = [project('p-1', 'Inbox'), project('p-2', 'Work')]
    const sessions = [
      session('s-a', 'p-1', '2026-04-19T10:00:00Z'),
      session('s-b', 'p-2', '2026-04-19T11:00:00Z'),
      session('s-c', 'p-1', '2026-04-19T12:00:00Z'),
    ]

    const groups = groupSessionsByProject(projects, sessions)

    expect(groups).toHaveLength(2)
    expect(groups[0].project?.id).toBe('p-1')
    expect(groups[0].sessions.map(s => s.id)).toEqual(['s-c', 's-a'])
    expect(groups[1].project?.id).toBe('p-2')
    expect(groups[1].sessions.map(s => s.id)).toEqual(['s-b'])
  })

  it('sorts sessions within a project by updated_at desc', () => {
    const projects = [project('p-1', 'Inbox')]
    const sessions = [
      session('old', 'p-1', '2026-04-01T00:00:00Z'),
      session('new', 'p-1', '2026-04-19T00:00:00Z'),
      session('mid', 'p-1', '2026-04-10T00:00:00Z'),
    ]

    const groups = groupSessionsByProject(projects, sessions)

    expect(groups[0].sessions.map(s => s.id)).toEqual(['new', 'mid', 'old'])
  })

  it('keeps empty projects in the list so users can drop sessions in', () => {
    const projects = [project('p-1', 'Inbox'), project('p-2', 'Empty')]
    const sessions = [session('s-a', 'p-1', '2026-04-19T10:00:00Z')]

    const groups = groupSessionsByProject(projects, sessions)

    expect(groups).toHaveLength(2)
    expect(groups[1].project?.id).toBe('p-2')
    expect(groups[1].sessions).toEqual([])
  })

  it('routes orphaned sessions into the Inbox project when one exists', () => {
    const projects = [project('p-inbox', 'Inbox')]
    const sessions = [
      session('s-a', null, '2026-04-19T10:00:00Z'),
      session('s-b', 'p-inbox', '2026-04-19T11:00:00Z'),
      session('s-c', 'p-missing', '2026-04-19T12:00:00Z'),
    ]

    const groups = groupSessionsByProject(projects, sessions)

    expect(groups).toHaveLength(1)
    expect(groups[0].project?.title).toBe('Inbox')
    expect(groups[0].sessions.map(s => s.id).sort()).toEqual(['s-a', 's-b', 's-c'])
  })

  it('creates a synthetic Inbox when no Inbox project exists and orphans are present', () => {
    const projects = [project('p-1', 'Work')]
    const sessions = [
      session('s-a', null, '2026-04-19T10:00:00Z'),
      session('s-b', 'p-1', '2026-04-19T11:00:00Z'),
    ]

    const groups = groupSessionsByProject(projects, sessions)

    expect(groups).toHaveLength(2)
    expect(groups[0].project?.id).toBe('p-1')
    expect(groups[1].project).toBeNull()
    expect(projectGroupId(groups[1])).toBe(SYNTHETIC_INBOX_ID)
    expect(projectGroupLabel(groups[1])).toBe('Inbox')
    expect(groups[1].sessions.map(s => s.id)).toEqual(['s-a'])
  })

  it('does not create a synthetic Inbox when there are no orphans', () => {
    const projects = [project('p-1', 'Work')]
    const sessions = [session('s-a', 'p-1', '2026-04-19T10:00:00Z')]

    const groups = groupSessionsByProject(projects, sessions)

    expect(groups).toHaveLength(1)
    expect(groups[0].project?.id).toBe('p-1')
  })

  it('treats an archived Inbox as not-Inbox for orphan routing', () => {
    const projects = [project('p-inbox', 'Inbox', true)]
    const sessions = [session('s-a', null, '2026-04-19T10:00:00Z')]

    const groups = groupSessionsByProject(projects, sessions)

    // Two groups: archived Inbox (empty) + synthetic Inbox holding the orphan.
    expect(groups).toHaveLength(2)
    expect(groups[0].project?.archived_at).not.toBeNull()
    expect(groups[1].project).toBeNull()
    expect(groups[1].sessions.map(s => s.id)).toEqual(['s-a'])
  })

  it('handles the empty case', () => {
    expect(groupSessionsByProject([], [])).toEqual([])
  })
})

describe('collapsed-projects persistence', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    const fakeStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { for (const k of Object.keys(store)) delete store[k] },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length },
    }
    ;(globalThis as { window?: unknown }).window = { localStorage: fakeStorage }
  })

  it('round-trips a Set through localStorage', () => {
    saveCollapsedProjects(new Set(['p-1', 'p-2']))
    const loaded = loadCollapsedProjects()
    expect(loaded.has('p-1')).toBe(true)
    expect(loaded.has('p-2')).toBe(true)
    expect(loaded.size).toBe(2)
  })

  it('returns an empty set when nothing has been saved', () => {
    expect(loadCollapsedProjects().size).toBe(0)
  })

  it('returns an empty set when the stored value is corrupt', () => {
    ;(globalThis as { window: { localStorage: Storage } }).window.localStorage.setItem(
      'markup.sidebar.collapsedProjects',
      '{not json',
    )
    expect(loadCollapsedProjects().size).toBe(0)
  })

  it('ignores non-string entries defensively', () => {
    ;(globalThis as { window: { localStorage: Storage } }).window.localStorage.setItem(
      'markup.sidebar.collapsedProjects',
      JSON.stringify(['p-1', 42, null, 'p-2']),
    )
    const loaded = loadCollapsedProjects()
    expect(loaded.has('p-1')).toBe(true)
    expect(loaded.has('p-2')).toBe(true)
    expect(loaded.size).toBe(2)
  })
})
