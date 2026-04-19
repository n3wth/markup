import type { Project, Session } from '../types'

export interface ProjectGroup {
  project: Project | null
  sessions: Session[]
}

/**
 * Group sessions under their owning projects for the sidebar tree.
 *
 * Ordering rules:
 *  - Active (non-archived) projects come first, in the order supplied by
 *    {@link loadProjects} (which already sorts archived to the end and
 *    newest-first within each bucket).
 *  - Sessions without a `project_id` and sessions whose `project_id`
 *    points at no known project both fall into a synthetic "Inbox" group.
 *    The synthetic group is rendered only when the user has no real
 *    Inbox project — once {@link createInboxProject} has run server-side,
 *    every session has a home and the synthetic group is suppressed.
 *  - Within a project, sessions sort newest-`updated_at` first to match
 *    the flat list's ordering.
 *  - Empty projects are kept in the list so the user can see them and
 *    drop sessions into them later (T007).
 *
 * Archive-below-fold and drag-to-reorder are out of scope here — they
 * arrive with W1-T007. This function only does the grouping shape.
 */
export function groupSessionsByProject(
  projects: Project[],
  sessions: Session[],
): ProjectGroup[] {
  const byId = new Map<string, ProjectGroup>()
  for (const p of projects) {
    byId.set(p.id, { project: p, sessions: [] })
  }

  const orphaned: Session[] = []
  for (const s of sessions) {
    if (s.project_id && byId.has(s.project_id)) {
      byId.get(s.project_id)!.sessions.push(s)
    } else {
      orphaned.push(s)
    }
  }

  for (const group of byId.values()) {
    group.sessions.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
  }
  orphaned.sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )

  const groups: ProjectGroup[] = projects.map(p => byId.get(p.id)!)

  if (orphaned.length > 0) {
    const hasInboxProject = projects.some(
      p => p.title === 'Inbox' && !p.archived_at,
    )
    if (!hasInboxProject) {
      groups.push({ project: null, sessions: orphaned })
    } else {
      const inboxGroup = groups.find(
        g => g.project?.title === 'Inbox' && !g.project.archived_at,
      )
      if (inboxGroup) inboxGroup.sessions.push(...orphaned)
    }
  }

  return groups
}

const COLLAPSED_KEY = 'markup.sidebar.collapsedProjects'

/**
 * Read the per-project collapsed state from localStorage. Returns a Set
 * of project ids the user has collapsed. The synthetic Inbox group uses
 * the literal id `"__inbox__"`. SSR/no-localStorage callers get an
 * empty set.
 */
export function loadCollapsedProjects(): Set<string> {
  if (typeof window === 'undefined' || !window.localStorage) return new Set()
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set(parsed.filter(x => typeof x === 'string'))
    return new Set()
  } catch {
    return new Set()
  }
}

export function saveCollapsedProjects(ids: Set<string>): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]))
  } catch {
    // Quota or privacy mode — collapsing just won't persist.
  }
}

export const SYNTHETIC_INBOX_ID = '__inbox__'

export function projectGroupId(group: ProjectGroup): string {
  return group.project?.id ?? SYNTHETIC_INBOX_ID
}

export function projectGroupLabel(group: ProjectGroup): string {
  return group.project?.title ?? 'Inbox'
}
