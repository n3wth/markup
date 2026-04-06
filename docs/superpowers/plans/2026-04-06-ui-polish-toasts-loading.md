# UI Polish: Toast System + Loading States

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add toast notifications, skeleton loaders, a save progress bar, and improve the error boundary to match production-quality app standards.

**Architecture:** Toast system via React context provider. Skeleton components as pure CSS animations. Progress bar as a thin animated div. Error boundary gets a recovery UI. All use existing design tokens from index.css.

**Tech Stack:** React 19, CSS (no animation libraries), existing design tokens

---

### Task 1: Toast context provider and component

**Files:**
- Create: `src/components/Toast.tsx`
- Modify: `src/App.css` (append toast styles)
- Modify: `src/App.tsx` (wrap with ToastProvider)

### Task 2: Wire toasts into existing error/success paths

**Files:**
- Modify: `src/hooks/useOrchestrator.ts` (agent errors -> toast)
- Modify: `src/App.tsx` (save errors -> toast, download success -> toast)

### Task 3: Skeleton loader components

**Files:**
- Create: `src/components/Skeleton.tsx`
- Modify: `src/App.css` (append skeleton styles)
- Modify: `src/Sidebar.tsx` (skeleton rows while loading)
- Modify: `src/components/ChatPanel.tsx` (skeleton messages while loading)

### Task 4: Save progress bar

**Files:**
- Create: `src/components/ProgressBar.tsx`
- Modify: `src/App.css` (append progress bar styles)
- Modify: `src/App.tsx` (show during save)

### Task 5: Error boundary recovery UI

**Files:**
- Modify: `src/components/ErrorBoundary.tsx` (add styled recovery card with reload)
- Modify: `src/App.css` (append error boundary styles)
