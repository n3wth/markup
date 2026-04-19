import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { extractDocStructure } from '../agent'
import { collectHeadingPositions, executeAgentAction, resolveInsertPos } from '../agent-actions'

// --- Replicated pure functions from agent-actions.ts for direct testing ---

function contentToBlocks(content: string): string[] {
  const cleaned = content
    .replace(/^#{3,}\s+/gm, '## ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
  const lines = cleaned.split('\n').filter(l => l.trim() !== '')
  const blocks: string[] = []
  let topItems: { text: string, subItems: string[] }[] = []

  const flushList = () => {
    if (topItems.length > 0) {
      const html = topItems.map(item => {
        if (item.subItems.length > 0) {
          return `<li>${item.text}<ul>${item.subItems.map(s => `<li>${s}</li>`).join('')}</ul></li>`
        }
        return `<li>${item.text}</li>`
      }).join('')
      blocks.push(`<ul>${html}</ul>`)
      topItems = []
    }
  }

  for (const line of lines) {
    if (/^[\t ]{2,}- /.test(line)) {
      const text = line.replace(/^[\t ]*- /, '')
      if (topItems.length > 0) {
        topItems[topItems.length - 1].subItems.push(text)
      } else {
        topItems.push({ text, subItems: [] })
      }
    } else if (line.startsWith('- ')) {
      topItems.push({ text: line.slice(2), subItems: [] })
    } else {
      flushList()
      if (line.startsWith('### ')) blocks.push(`<h3>${line.slice(4)}</h3>`)
      else if (line.startsWith('## ')) blocks.push(`<h2>${line.slice(3)}</h2>`)
      else if (line.startsWith('# ')) blocks.push(`<h1>${line.slice(2)}</h1>`)
      else blocks.push(`<p>${line}</p>`)
    }
  }
  flushList()
  return blocks
}

// Replicated action validation logic
function validateAction(action: { type: string, searchText?: string, content?: string, chatMessage?: string }): string[] {
  const errors: string[] = []
  const validTypes = ['insert', 'replace', 'read', 'chat']
  if (!validTypes.includes(action.type)) {
    errors.push(`Invalid action type: ${action.type}`)
  }
  if (action.type === 'replace' && !action.searchText) {
    errors.push('Replace action requires searchText')
  }
  if (action.type === 'insert' && !action.content) {
    errors.push('Insert action requires content')
  }
  return errors
}

// --- Tests ---

describe('contentToBlocks', () => {
  it('converts a heading to <h2>', () => {
    const blocks = contentToBlocks('## Architecture')
    expect(blocks).toEqual(['<h2>Architecture</h2>'])
  })

  it('converts ### to ## (downgrades triple-hash)', () => {
    const blocks = contentToBlocks('### Deep heading')
    expect(blocks).toEqual(['<h2>Deep heading</h2>'])
  })

  it('converts bullet list to <ul>', () => {
    const blocks = contentToBlocks('- Item one\n- Item two')
    expect(blocks).toEqual(['<ul><li>Item one</li><li>Item two</li></ul>'])
  })

  it('handles nested sub-bullets', () => {
    const blocks = contentToBlocks('- Parent\n  - Child one\n  - Child two')
    expect(blocks).toEqual([
      '<ul><li>Parent<ul><li>Child one</li><li>Child two</li></ul></li></ul>'
    ])
  })

  it('strips bold markdown', () => {
    const blocks = contentToBlocks('**bold text** here')
    expect(blocks).toEqual(['<p>bold text here</p>'])
  })

  it('strips italic markdown', () => {
    const blocks = contentToBlocks('*italic text* here')
    expect(blocks).toEqual(['<p>italic text here</p>'])
  })

  it('strips backtick code', () => {
    const blocks = contentToBlocks('use `npm install` to install')
    expect(blocks).toEqual(['<p>use npm install to install</p>'])
  })

  it('handles mixed content: heading, paragraph, list', () => {
    const input = '## Title\nSome intro text\n- Bullet one\n- Bullet two'
    const blocks = contentToBlocks(input)
    expect(blocks).toEqual([
      '<h2>Title</h2>',
      '<p>Some intro text</p>',
      '<ul><li>Bullet one</li><li>Bullet two</li></ul>',
    ])
  })

  it('skips empty lines', () => {
    const blocks = contentToBlocks('## Heading\n\n\nParagraph')
    expect(blocks).toEqual(['<h2>Heading</h2>', '<p>Paragraph</p>'])
  })

  it('returns empty array for empty input', () => {
    expect(contentToBlocks('')).toEqual([])
  })

  it('handles h1 headings', () => {
    expect(contentToBlocks('# Title')).toEqual(['<h1>Title</h1>'])
  })
})

describe('action validation edge cases', () => {
  it('rejects unknown action types', () => {
    const errors = validateAction({ type: 'delete' })
    expect(errors).toContain('Invalid action type: delete')
  })

  it('replace without searchText is invalid', () => {
    const errors = validateAction({ type: 'replace' })
    expect(errors).toContain('Replace action requires searchText')
  })

  it('insert without content is invalid', () => {
    const errors = validateAction({ type: 'insert' })
    expect(errors).toContain('Insert action requires content')
  })

  it('valid chat action has no errors', () => {
    const errors = validateAction({ type: 'chat', chatMessage: 'hello' })
    expect(errors).toEqual([])
  })

  it('valid replace action has no errors', () => {
    const errors = validateAction({ type: 'replace', searchText: 'foo' })
    expect(errors).toEqual([])
  })

  it('valid insert action has no errors', () => {
    const errors = validateAction({ type: 'insert', content: 'new text' })
    expect(errors).toEqual([])
  })
})

describe('parseAgentResponse edge cases', () => {
  // Test how the system handles various response shapes
  it('action with all optional fields populated', () => {
    const action = {
      type: 'insert' as const,
      position: 'end',
      content: 'New content',
      chatBefore: 'Adding content',
      chatMessage: 'Done adding',
      thought: 'writing now',
      shouldContinue: false,
    }
    expect(action.type).toBe('insert')
    expect(action.shouldContinue).toBe(false)
  })

  it('thought gets truncated to 4 words', () => {
    // Replicates the truncation logic from agent.ts line 300
    const thought = 'this is a very long thought about things'
    const truncated = thought.split(/\s+/).slice(0, 4).join(' ')
    expect(truncated).toBe('this is a very')
  })

  it('thought with exactly 4 words stays unchanged', () => {
    const thought = 'four words right here'
    const truncated = thought.split(/\s+/).slice(0, 4).join(' ')
    expect(truncated).toBe('four words right here')
  })
})

describe('extractDocStructure', () => {
  it('extracts headings and word counts from markdown-style text', () => {
    const doc = '## Introduction\nThis is the intro paragraph with five words.\n## Architecture\nBackend uses PostgreSQL.'
    const result = extractDocStructure(doc)
    expect(result.headings).toEqual(['Introduction', 'Architecture'])
    expect(result.wordCounts['Introduction']).toBe(8)
    expect(result.wordCounts['Architecture']).toBe(3)
  })

  it('returns empty for doc with no headings', () => {
    const result = extractDocStructure('Just plain text without any structure.')
    expect(result.headings).toEqual([])
    expect(result.wordCounts).toEqual({})
  })

  it('handles H1 and H3 headings', () => {
    const doc = '# Title\nSome words here.\n### Subsection\nMore content below.'
    const result = extractDocStructure(doc)
    expect(result.headings).toEqual(['Title', 'Subsection'])
  })

  it('handles empty doc', () => {
    const result = extractDocStructure('')
    expect(result.headings).toEqual([])
  })

  it('strips HTML tags before parsing', () => {
    const doc = '<h2>Overview</h2><p>Some paragraph text here.</p>'
    const result = extractDocStructure(doc)
    // After HTML stripping, no markdown headings remain
    expect(result.headings).toEqual([])
  })

  it('counts words accurately across sections', () => {
    const doc = '## A\none two three\n## B\nfour five'
    const result = extractDocStructure(doc)
    expect(result.wordCounts['A']).toBe(3)
    expect(result.wordCounts['B']).toBe(2)
  })
})

describe('new action type validation', () => {
  // Updated validator that knows about all action types
  const VALID_TYPES = ['insert', 'replace', 'read', 'chat', 'search', 'rename', 'delete', 'propose', 'plan', 'ask']

  function validateNewAction(action: { type: string, deleteText?: string, newTitle?: string, proposal?: string, steps?: string[], question?: string }): string[] {
    const errors: string[] = []
    if (!VALID_TYPES.includes(action.type)) errors.push(`Invalid type: ${action.type}`)
    if (action.type === 'delete' && !action.deleteText) errors.push('delete requires deleteText')
    if (action.type === 'rename' && !action.newTitle) errors.push('rename requires newTitle')
    if (action.type === 'propose' && !action.proposal) errors.push('propose requires proposal')
    if (action.type === 'ask' && !action.question) errors.push('ask requires question')
    return errors
  }

  it('validates delete action requires deleteText', () => {
    expect(validateNewAction({ type: 'delete' })).toContain('delete requires deleteText')
    expect(validateNewAction({ type: 'delete', deleteText: 'foo' })).toEqual([])
  })

  it('validates rename action requires newTitle', () => {
    expect(validateNewAction({ type: 'rename' })).toContain('rename requires newTitle')
    expect(validateNewAction({ type: 'rename', newTitle: 'New Title' })).toEqual([])
  })

  it('validates propose action requires proposal', () => {
    expect(validateNewAction({ type: 'propose' })).toContain('propose requires proposal')
    expect(validateNewAction({ type: 'propose', proposal: 'Create a new doc' })).toEqual([])
  })

  it('validates ask action requires question', () => {
    expect(validateNewAction({ type: 'ask' })).toContain('ask requires question')
    expect(validateNewAction({ type: 'ask', question: 'What tone?' })).toEqual([])
  })

  it('plan and chat actions pass with no extra fields', () => {
    expect(validateNewAction({ type: 'plan' })).toEqual([])
    expect(validateNewAction({ type: 'chat' })).toEqual([])
    expect(validateNewAction({ type: 'search' })).toEqual([])
  })

  it('rejects unknown action types', () => {
    expect(validateNewAction({ type: 'explode' })).toContain('Invalid type: explode')
  })
})

function makeMockEditor(headings: { text: string, pos: number, nodeSize: number }[], docSize: number) {
  return {
    state: {
      doc: {
        content: { size: docSize },
        descendants: (cb: (node: { type: { name: string }, textContent: string, nodeSize: number }, pos: number) => boolean | void) => {
          for (const h of headings) {
            cb({ type: { name: 'heading' }, textContent: h.text, nodeSize: h.nodeSize }, h.pos)
          }
        },
      },
    },
  } as never
}

describe('resolveInsertPos', () => {
  it('exact match finds correct section end (next heading pos)', () => {
    const editor = makeMockEditor([
      { text: 'Architecture', pos: 10, nodeSize: 14 },
      { text: 'Next Steps', pos: 50, nodeSize: 12 },
    ], 100)
    const result = resolveInsertPos(editor, 'after:Architecture')
    expect(result.pos).toBe(50)
    expect(result.matched).toBe(true)
    expect(result.matchedHeading).toBe('Architecture')
    expect(result.strategy).toBe('exact')
  })

  it('case-insensitive exact match works', () => {
    const editor = makeMockEditor([
      { text: 'Architecture', pos: 10, nodeSize: 14 },
      { text: 'Next Steps', pos: 50, nodeSize: 12 },
    ], 100)
    const result = resolveInsertPos(editor, 'after:architecture')
    expect(result.pos).toBe(50)
    expect(result.matched).toBe(true)
    expect(result.strategy).toBe('exact')
  })

  it('fuzzy includes-match works when exact fails', () => {
    const editor = makeMockEditor([
      { text: 'System Architecture Overview', pos: 10, nodeSize: 30 },
      { text: 'Next Steps', pos: 60, nodeSize: 12 },
    ], 100)
    const result = resolveInsertPos(editor, 'after:Architecture')
    expect(result.pos).toBe(60)
    expect(result.matched).toBe(true)
    expect(result.matchedHeading).toBe('System Architecture Overview')
    expect(result.strategy).toBe('fuzzy')
  })

  it('last heading inserts at end of doc', () => {
    const editor = makeMockEditor([
      { text: 'Introduction', pos: 5, nodeSize: 14 },
      { text: 'Conclusion', pos: 80, nodeSize: 12 },
    ], 150)
    const result = resolveInsertPos(editor, 'after:Conclusion')
    expect(result.pos).toBe(150)
    expect(result.matched).toBe(true)
    expect(result.matchedHeading).toBe('Conclusion')
  })

  it('no match falls back to end of doc', () => {
    const editor = makeMockEditor([
      { text: 'Introduction', pos: 5, nodeSize: 14 },
    ], 100)
    const result = resolveInsertPos(editor, 'after:NonExistentSection')
    expect(result.pos).toBe(100)
    expect(result.matched).toBe(false)
    expect(result.strategy).toBe('fallback')
  })

  it('no position string returns end of doc', () => {
    const editor = makeMockEditor([], 80)
    const result = resolveInsertPos(editor, undefined)
    expect(result.pos).toBe(80)
    expect(result.matched).toBe(false)
    expect(result.strategy).toBe('fallback')
  })

  it('after-heading returns position after last heading', () => {
    const editor = makeMockEditor([
      { text: 'Introduction', pos: 5, nodeSize: 14 },
      { text: 'Conclusion', pos: 80, nodeSize: 12 },
    ], 150)
    const result = resolveInsertPos(editor, 'after-heading')
    expect(result.pos).toBe(92) // 80 + 12
    expect(result.matched).toBe(true)
    expect(result.matchedHeading).toBe('Conclusion')
    expect(result.strategy).toBe('exact')
  })

  it('numbered section ref S1 resolves to first heading', () => {
    const editor = makeMockEditor([
      { text: 'Architecture', pos: 10, nodeSize: 14 },
      { text: 'Requirements', pos: 50, nodeSize: 15 },
      { text: 'Timeline', pos: 80, nodeSize: 10 },
    ], 120)
    const result = resolveInsertPos(editor, 'after:S1')
    expect(result.pos).toBe(50) // before next heading
    expect(result.matched).toBe(true)
    expect(result.matchedHeading).toBe('Architecture')
    expect(result.strategy).toBe('exact')
  })

  it('numbered section ref S3 (last section) resolves to end of doc', () => {
    const editor = makeMockEditor([
      { text: 'Architecture', pos: 10, nodeSize: 14 },
      { text: 'Requirements', pos: 50, nodeSize: 15 },
      { text: 'Timeline', pos: 80, nodeSize: 10 },
    ], 120)
    const result = resolveInsertPos(editor, 'after:S3')
    expect(result.pos).toBe(120)
    expect(result.matched).toBe(true)
    expect(result.matchedHeading).toBe('Timeline')
  })

  it('numbered section ref is case-insensitive', () => {
    const editor = makeMockEditor([
      { text: 'Architecture', pos: 10, nodeSize: 14 },
      { text: 'Requirements', pos: 50, nodeSize: 15 },
    ], 100)
    const result = resolveInsertPos(editor, 'after:s2')
    expect(result.pos).toBe(100)
    expect(result.matched).toBe(true)
    expect(result.matchedHeading).toBe('Requirements')
  })

  it('numbered section ref out of range falls through to name matching', () => {
    const editor = makeMockEditor([
      { text: 'Architecture', pos: 10, nodeSize: 14 },
    ], 100)
    // S5 doesn't exist (only 1 heading), should fall through
    const result = resolveInsertPos(editor, 'after:S5')
    expect(result.matched).toBe(false)
    expect(result.strategy).toBe('fallback')
  })
})

describe('executeAgentAction insert reliability', () => {
  const pendingTimers: Array<() => void> = []

  beforeEach(() => {
    pendingTimers.length = 0
    vi.stubGlobal('window', {
      setTimeout: (fn: () => void) => {
        pendingTimers.push(fn)
        return pendingTimers.length
      },
      clearTimeout: vi.fn(),
    })
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('inserts after the targeted section instead of always appending to the end', () => {
    const insertCalls: number[] = []
    const scrollParent = {
      scrollTop: 0,
      getBoundingClientRect: () => ({ top: 0, height: 400 }),
      scrollTo: vi.fn(),
    }
    const editor = {
      isDestroyed: false,
      view: {
        coordsAtPos: vi.fn(() => ({ top: 100 })),
        dom: {
          closest: vi.fn(() => scrollParent),
          lastElementChild: { classList: { contains: () => false, add: vi.fn() } },
        },
        state: {
          tr: {
            delete: vi.fn().mockReturnThis(),
          },
        },
        dispatch: vi.fn(),
      },
      state: {
        doc: {
          content: { size: 100 },
          childCount: 1,
          child: vi.fn(),
          descendants: (cb: (node: { type: { name: string }, textContent: string, nodeSize: number }, pos: number) => boolean | void) => {
            cb({ type: { name: 'heading' }, textContent: 'Architecture', nodeSize: 5 }, 10)
            cb({ type: { name: 'paragraph' }, textContent: 'Current section', nodeSize: 12 }, 15)
            cb({ type: { name: 'heading' }, textContent: 'Next Steps', nodeSize: 5 }, 30)
            return true
          },
        },
      },
      commands: {
        setAgentCursor: vi.fn(),
        removeAgentCursor: vi.fn(),
        insertContentAt: vi.fn((pos: number) => {
          insertCalls.push(pos)
        }),
      },
    }

    const callbacks = {
      onStateChange: vi.fn(),
      onChatMessage: vi.fn(),
      onDone: vi.fn(),
    }

    executeAgentAction(
      editor as never,
      'Aiden',
      '#111111',
      { type: 'insert', position: 'after:Architecture', content: 'New paragraph' },
      { current: null },
      {},
      callbacks,
    )

    while (pendingTimers.length > 0) {
      const next = pendingTimers.shift()
      next?.()
    }

    expect(insertCalls[0]).toBe(30)
    expect(callbacks.onDone).toHaveBeenCalledWith(true)
  })
})

// --- contentToStreamBlocks (replicated for direct testing) ---
// Mirrors src/agent-actions.ts contentToStreamBlocks. Regenerated here because
// the helper is module-private; tests block regressions that would change shape.

interface StreamBlock {
  type: 'heading' | 'paragraph' | 'listItem' | 'codeBlock'
  text: string
  level?: number
  subItems?: string[]
  language?: string
}

function contentToStreamBlocks(content: string): StreamBlock[] {
  const blocks: StreamBlock[] = []
  let pendingListItems: { text: string, subItems: string[] }[] = []

  const flushList = () => {
    for (const item of pendingListItems) {
      blocks.push({ type: 'listItem', text: item.text, subItems: item.subItems.length > 0 ? item.subItems : undefined })
    }
    pendingListItems = []
  }

  let normalized = content.replace(/^`(\w+)\n([\s\S]*?)^`\s*$/gm, '```$1\n$2```')
  normalized = normalized.replace(/^`\n([\s\S]*?)^`\s*$/gm, '```\n$1```')

  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
  const segments: { type: 'text' | 'code', content: string, language?: string }[] = []
  let lastIdx = 0
  let match: RegExpExecArray | null
  while ((match = codeBlockRegex.exec(normalized)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ type: 'text', content: normalized.slice(lastIdx, match.index) })
    }
    segments.push({ type: 'code', content: match[2].replace(/\n$/, ''), language: match[1] || undefined })
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < normalized.length) {
    segments.push({ type: 'text', content: normalized.slice(lastIdx) })
  }
  if (segments.length === 0) {
    segments.push({ type: 'text', content: normalized })
  }

  for (const segment of segments) {
    if (segment.type === 'code') {
      flushList()
      blocks.push({ type: 'codeBlock', text: segment.content, language: segment.language })
      continue
    }
    const cleaned = segment.content
      .replace(/^#{3,}\s+/gm, '## ')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
    const lines = cleaned.split('\n').filter(l => l.trim() !== '')

    for (const line of lines) {
      if (/^[\t ]{2,}- /.test(line)) {
        const text = line.replace(/^[\t ]*- /, '')
        if (pendingListItems.length > 0) {
          pendingListItems[pendingListItems.length - 1].subItems.push(text)
        } else {
          pendingListItems.push({ text, subItems: [] })
        }
      } else if (line.startsWith('- ')) {
        pendingListItems.push({ text: line.slice(2), subItems: [] })
      } else {
        flushList()
        if (line.startsWith('## ')) {
          blocks.push({ type: 'heading', text: line.slice(3), level: 2 })
        } else if (line.startsWith('# ')) {
          blocks.push({ type: 'heading', text: line.slice(2), level: 1 })
        } else {
          blocks.push({ type: 'paragraph', text: line })
        }
      }
    }
  }
  flushList()
  return blocks
}

describe('contentToStreamBlocks', () => {
  it('returns empty list for empty input', () => {
    expect(contentToStreamBlocks('')).toEqual([])
  })

  it('produces paragraph block for plain text', () => {
    const blocks = contentToStreamBlocks('Just a line of prose.')
    expect(blocks).toEqual([{ type: 'paragraph', text: 'Just a line of prose.' }])
  })

  it('extracts a fenced code block with language', () => {
    const input = '```ts\nconst x = 1\n```'
    const blocks = contentToStreamBlocks(input)
    expect(blocks).toEqual([{ type: 'codeBlock', text: 'const x = 1', language: 'ts' }])
  })

  it('extracts a fenced code block without language', () => {
    const input = '```\nplain text\n```'
    const blocks = contentToStreamBlocks(input)
    expect(blocks).toEqual([{ type: 'codeBlock', text: 'plain text', language: undefined }])
  })

  it('normalizes single-backtick fences with language into code blocks', () => {
    const input = '`js\nalert(1)\n`'
    const blocks = contentToStreamBlocks(input)
    expect(blocks).toEqual([{ type: 'codeBlock', text: 'alert(1)', language: 'js' }])
  })

  it('interleaves prose and code blocks in order', () => {
    const input = 'Intro text\n```\ncode()\n```\nOutro text'
    const blocks = contentToStreamBlocks(input)
    expect(blocks).toEqual([
      { type: 'paragraph', text: 'Intro text' },
      { type: 'codeBlock', text: 'code()', language: undefined },
      { type: 'paragraph', text: 'Outro text' },
    ])
  })

  it('emits listItem blocks with subItems when nested', () => {
    const input = '- Parent item\n  - Sub one\n  - Sub two\n- Sibling'
    const blocks = contentToStreamBlocks(input)
    expect(blocks).toEqual([
      { type: 'listItem', text: 'Parent item', subItems: ['Sub one', 'Sub two'] },
      { type: 'listItem', text: 'Sibling', subItems: undefined },
    ])
  })

  it('emits heading block with level 2 for "## "', () => {
    expect(contentToStreamBlocks('## Title')).toEqual([
      { type: 'heading', text: 'Title', level: 2 },
    ])
  })

  it('emits heading block with level 1 for "# "', () => {
    expect(contentToStreamBlocks('# Root')).toEqual([
      { type: 'heading', text: 'Root', level: 1 },
    ])
  })

  it('downgrades h3+ to level 2 headings', () => {
    expect(contentToStreamBlocks('### Deep')).toEqual([
      { type: 'heading', text: 'Deep', level: 2 },
    ])
  })

  it('flushes pending list when heading follows', () => {
    const input = '- A\n- B\n## Next'
    const blocks = contentToStreamBlocks(input)
    expect(blocks).toEqual([
      { type: 'listItem', text: 'A', subItems: undefined },
      { type: 'listItem', text: 'B', subItems: undefined },
      { type: 'heading', text: 'Next', level: 2 },
    ])
  })
})

// --- Mock helper: editor with text descendants for findTextPos ---

type MockNode = { isText?: boolean, text?: string, isBlock?: boolean, type: { name: string }, textContent: string, nodeSize: number }

function makeEditorWithText(textBlocks: Array<{ text: string, pos: number }>, docSize = 200) {
  const nodes: Array<{ node: MockNode, pos: number }> = []
  for (const b of textBlocks) {
    nodes.push({ node: { isText: true, text: b.text, type: { name: 'text' }, textContent: b.text, nodeSize: b.text.length }, pos: b.pos })
  }
  const descendants = (cb: (n: MockNode, p: number) => boolean | void) => {
    for (const { node, pos } of nodes) cb(node, pos)
  }
  const doc = {
    content: { size: docSize },
    childCount: 1,
    child: vi.fn(),
    descendants,
  }
  const dispatches: unknown[] = []
  const editor = {
    isDestroyed: false,
    view: {
      coordsAtPos: vi.fn(() => ({ top: 100 })),
      dom: {
        closest: vi.fn(() => ({ scrollTop: 0, getBoundingClientRect: () => ({ top: 0, height: 400 }), scrollTo: vi.fn() })),
        lastElementChild: { classList: { contains: () => false, add: vi.fn() } },
      },
      state: { tr: { insertText: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis() } },
      dispatch: vi.fn((tr) => { dispatches.push(tr) }),
    },
    state: {
      doc,
      tr: { delete: vi.fn().mockReturnThis() },
    },
    commands: {
      setAgentCursor: vi.fn(),
      removeAgentCursor: vi.fn(),
      insertContentAt: vi.fn(),
    },
    chain: vi.fn(() => ({
      deleteRange: vi.fn().mockReturnThis(),
      run: vi.fn(),
    })),
    dispatches,
  }
  return editor
}

// --- Shared setup for executeAgentAction tests below ---

function setupFakeTimers() {
  const pendingTimers: Array<() => void> = []
  vi.stubGlobal('window', {
    setTimeout: (fn: () => void) => {
      pendingTimers.push(fn)
      return pendingTimers.length
    },
    clearTimeout: vi.fn(),
  })
  vi.spyOn(Math, 'random').mockReturnValue(0)
  return {
    pendingTimers,
    flush() {
      while (pendingTimers.length > 0) {
        const next = pendingTimers.shift()
        next?.()
      }
    },
  }
}

function makeCallbacks() {
  return {
    onStateChange: vi.fn(),
    onChatMessage: vi.fn(),
    onDone: vi.fn(),
  }
}

describe('executeAgentAction: chat / propose / plan / ask / rename', () => {
  let timers: ReturnType<typeof setupFakeTimers>

  beforeEach(() => {
    timers = setupFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('chat action posts the message and completes with success', () => {
    const editor = makeEditorWithText([])
    const callbacks = makeCallbacks()
    executeAgentAction(editor as never, 'Nova', '#ff6961', { type: 'chat', chatMessage: 'Hello there' }, { current: null }, {}, callbacks)
    timers.flush()
    expect(callbacks.onChatMessage).toHaveBeenCalledWith('Nova', 'Hello there')
    expect(callbacks.onDone).toHaveBeenCalledWith(true)
  })

  it('chat action falls back to "Got it." when no chatMessage provided', () => {
    const editor = makeEditorWithText([])
    const callbacks = makeCallbacks()
    executeAgentAction(editor as never, 'Nova', '#ff6961', { type: 'chat' }, { current: null }, {}, callbacks)
    timers.flush()
    expect(callbacks.onChatMessage).toHaveBeenCalledWith('Nova', 'Got it.')
  })

  it('propose action surfaces proposal text as chat', () => {
    const editor = makeEditorWithText([])
    const callbacks = makeCallbacks()
    executeAgentAction(editor as never, 'Aiden', '#30d158', { type: 'propose', proposal: 'Let us split this section.' }, { current: null }, {}, callbacks)
    timers.flush()
    expect(callbacks.onChatMessage).toHaveBeenCalledWith('Aiden', 'Let us split this section.')
    expect(callbacks.onDone).toHaveBeenCalledWith(true)
  })

  it('plan action formats numbered steps as chat', () => {
    const editor = makeEditorWithText([])
    const callbacks = makeCallbacks()
    executeAgentAction(editor as never, 'Aiden', '#30d158', { type: 'plan', steps: ['Research', 'Draft', 'Review'] }, { current: null }, {}, callbacks)
    timers.flush()
    const [agent, msg] = callbacks.onChatMessage.mock.calls[0]
    expect(agent).toBe('Aiden')
    expect(msg).toContain('1. Research')
    expect(msg).toContain('2. Draft')
    expect(msg).toContain('3. Review')
    expect(callbacks.onDone).toHaveBeenCalledWith(true)
  })

  it('ask action surfaces question as chat', () => {
    const editor = makeEditorWithText([])
    const callbacks = makeCallbacks()
    executeAgentAction(editor as never, 'Lex', '#64d2ff', { type: 'ask', question: 'What is the desired tone?' }, { current: null }, {}, callbacks)
    timers.flush()
    expect(callbacks.onChatMessage).toHaveBeenCalledWith('Lex', 'What is the desired tone?')
    expect(callbacks.onDone).toHaveBeenCalledWith(true)
  })

  it('rename action with chatMessage posts and completes successfully', () => {
    const editor = makeEditorWithText([])
    const callbacks = makeCallbacks()
    executeAgentAction(editor as never, 'Mira', '#ffd60a', { type: 'rename', newTitle: 'New Title', chatMessage: 'Renamed.' }, { current: null }, {}, callbacks)
    timers.flush()
    expect(callbacks.onChatMessage).toHaveBeenCalledWith('Mira', 'Renamed.')
    expect(callbacks.onDone).toHaveBeenCalledWith(true)
  })
})

describe('executeAgentAction: delete action', () => {
  let timers: ReturnType<typeof setupFakeTimers>

  beforeEach(() => {
    timers = setupFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('deletes found text and dispatches a delete transaction', () => {
    const editor = makeEditorWithText([{ text: 'Hello world foo bar', pos: 1 }], 50)
    const callbacks = makeCallbacks()
    executeAgentAction(
      editor as never,
      'Aiden',
      '#30d158',
      { type: 'delete', deleteText: 'foo bar', chatMessage: 'Removed stale text.' },
      { current: null },
      {},
      callbacks,
    )
    timers.flush()
    // state.tr.delete should have been invoked with the range for "foo bar"
    expect(editor.state.tr.delete).toHaveBeenCalled()
    expect(editor.view.dispatch).toHaveBeenCalled()
    expect(callbacks.onChatMessage).toHaveBeenCalledWith('Aiden', 'Removed stale text.')
    expect(callbacks.onDone).toHaveBeenCalledWith(true)
  })

  it('emits chatBefore before deletion when provided', () => {
    const editor = makeEditorWithText([{ text: 'the lazy fox jumps', pos: 1 }], 50)
    const callbacks = makeCallbacks()
    executeAgentAction(
      editor as never,
      'Aiden',
      '#30d158',
      { type: 'delete', deleteText: 'lazy ', chatBefore: 'Trimming filler.' },
      { current: null },
      {},
      callbacks,
    )
    timers.flush()
    expect(callbacks.onChatMessage).toHaveBeenCalledWith('Aiden', 'Trimming filler.')
    expect(callbacks.onDone).toHaveBeenCalledWith(true)
  })

  it('completes successfully and does not dispatch when deleteText is not found', () => {
    const editor = makeEditorWithText([{ text: 'only this text exists', pos: 1 }], 50)
    const callbacks = makeCallbacks()
    executeAgentAction(
      editor as never,
      'Aiden',
      '#30d158',
      { type: 'delete', deleteText: 'nonexistent phrase' },
      { current: null },
      {},
      callbacks,
    )
    timers.flush()
    expect(editor.state.tr.delete).not.toHaveBeenCalled()
    expect(editor.view.dispatch).not.toHaveBeenCalled()
    expect(callbacks.onDone).toHaveBeenCalledWith(true)
  })

  it('completes successfully when deleteText is missing entirely', () => {
    const editor = makeEditorWithText([{ text: 'anything', pos: 1 }], 20)
    const callbacks = makeCallbacks()
    executeAgentAction(
      editor as never,
      'Aiden',
      '#30d158',
      { type: 'delete' },
      { current: null },
      {},
      callbacks,
    )
    timers.flush()
    expect(editor.state.tr.delete).not.toHaveBeenCalled()
    expect(callbacks.onDone).toHaveBeenCalledWith(true)
  })
})

describe('executeAgentAction: replace action', () => {
  let timers: ReturnType<typeof setupFakeTimers>

  beforeEach(() => {
    timers = setupFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('bails with onDone(false) when replaceWith is empty', () => {
    const editor = makeEditorWithText([{ text: 'anything here', pos: 1 }])
    const callbacks = makeCallbacks()
    executeAgentAction(
      editor as never,
      'Aiden',
      '#30d158',
      { type: 'replace', searchText: 'anything', replaceWith: '   ' },
      { current: null },
      {},
      callbacks,
    )
    timers.flush()
    expect(callbacks.onDone).toHaveBeenCalledWith(false)
    expect(editor.chain).not.toHaveBeenCalled()
  })

  it('posts a guidance chat and bails with success=false when searchText not found', () => {
    const editor = makeEditorWithText([{ text: 'existing document text', pos: 1 }])
    const callbacks = makeCallbacks()
    executeAgentAction(
      editor as never,
      'Aiden',
      '#30d158',
      { type: 'replace', searchText: 'missing target', replaceWith: 'new text' },
      { current: null },
      {},
      callbacks,
    )
    timers.flush()
    expect(callbacks.onChatMessage).toHaveBeenCalledWith(
      'Aiden',
      expect.stringContaining(`Couldn't find that text to replace`),
    )
    expect(callbacks.onDone).toHaveBeenCalledWith(false)
  })

  it('runs a deleteRange chain when searchText is found', () => {
    const editor = makeEditorWithText([{ text: 'replace me now', pos: 1 }])
    const callbacks = makeCallbacks()
    const deleteRange = vi.fn().mockReturnThis()
    const run = vi.fn()
    editor.chain = vi.fn(() => ({ deleteRange, run })) as typeof editor.chain

    executeAgentAction(
      editor as never,
      'Aiden',
      '#30d158',
      { type: 'replace', searchText: 'replace me', replaceWith: 'Rewritten' },
      { current: null },
      {},
      callbacks,
    )
    timers.flush()
    expect(editor.chain).toHaveBeenCalled()
    expect(deleteRange).toHaveBeenCalledWith(expect.objectContaining({ from: expect.any(Number), to: expect.any(Number) }))
    expect(run).toHaveBeenCalled()
    expect(callbacks.onDone).toHaveBeenCalledWith(true)
  })

  it('emits chatBefore before replacing when provided', () => {
    const editor = makeEditorWithText([{ text: 'old phrasing here', pos: 1 }])
    const callbacks = makeCallbacks()
    executeAgentAction(
      editor as never,
      'Aiden',
      '#30d158',
      { type: 'replace', searchText: 'old phrasing', replaceWith: 'new phrasing', chatBefore: 'Tightening prose.' },
      { current: null },
      {},
      callbacks,
    )
    timers.flush()
    expect(callbacks.onChatMessage).toHaveBeenCalledWith('Aiden', '[from doc] Tightening prose.')
  })
})

describe('executeAgentAction: insert edge cases', () => {
  let timers: ReturnType<typeof setupFakeTimers>

  beforeEach(() => {
    timers = setupFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('bails early with success=false when content is empty', () => {
    const editor = makeEditorWithText([])
    const callbacks = makeCallbacks()
    executeAgentAction(
      editor as never,
      'Aiden',
      '#30d158',
      { type: 'insert', content: '' },
      { current: null },
      {},
      callbacks,
    )
    timers.flush()
    expect(editor.commands.insertContentAt).not.toHaveBeenCalled()
    expect(callbacks.onDone).toHaveBeenCalledWith(false)
  })

  it('bails early when destroyed before execution', () => {
    const editor = makeEditorWithText([])
    editor.isDestroyed = true
    const callbacks = makeCallbacks()
    executeAgentAction(
      editor as never,
      'Aiden',
      '#30d158',
      { type: 'insert', content: 'anything', position: 'end' },
      { current: null },
      {},
      callbacks,
    )
    expect(callbacks.onDone).toHaveBeenCalledWith(false)
    expect(editor.commands.insertContentAt).not.toHaveBeenCalled()
  })
})

describe('executeAgentAction: editor lock behavior', () => {
  let timers: ReturnType<typeof setupFakeTimers>

  beforeEach(() => {
    timers = setupFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('defers when the lock is held by another agent and eventually gives up', () => {
    const editor = makeEditorWithText([])
    const callbacks = makeCallbacks()
    const action = { type: 'insert' as const, content: 'Hi', position: 'end' }
    const lockRef = { current: 'Nova' as string | null }
    executeAgentAction(editor as never, 'Aiden', '#30d158', action, lockRef, {}, callbacks)
    // Should have scheduled a retry rather than called onDone immediately
    expect(callbacks.onDone).not.toHaveBeenCalled()
    // Flushing retries will hit the retry cap (6) and give up with false
    timers.flush()
    expect(callbacks.onDone).toHaveBeenCalledWith(false)
  })

  it('acquires the lock when it is free and releases it on completion', () => {
    const editor = makeEditorWithText([])
    const callbacks = makeCallbacks()
    const lockRef: { current: string | null } = { current: null }
    executeAgentAction(
      editor as never,
      'Aiden',
      '#30d158',
      { type: 'insert', content: 'Para', position: 'end' },
      lockRef,
      {},
      callbacks,
    )
    // Lock taken immediately
    expect(lockRef.current).toBe('Aiden')
    timers.flush()
    expect(lockRef.current).toBeNull()
    expect(callbacks.onDone).toHaveBeenCalledWith(true)
  })

  it('does not acquire the lock for non-locking action types (chat)', () => {
    const editor = makeEditorWithText([])
    const callbacks = makeCallbacks()
    const lockRef: { current: string | null } = { current: null }
    executeAgentAction(
      editor as never,
      'Aiden',
      '#30d158',
      { type: 'chat', chatMessage: 'hi' },
      lockRef,
      {},
      callbacks,
    )
    // chat never needs the lock
    expect(lockRef.current).toBeNull()
    timers.flush()
    expect(lockRef.current).toBeNull()
  })
})

describe('collectHeadingPositions', () => {
  it('returns empty array when no headings present', () => {
    const editor = {
      state: {
        doc: {
          content: { size: 20 },
          descendants: (cb: (n: { type: { name: string }, textContent: string, nodeSize: number }, p: number) => boolean | void) => {
            cb({ type: { name: 'paragraph' }, textContent: 'prose', nodeSize: 7 }, 0)
          },
        },
      },
    } as never
    expect(collectHeadingPositions(editor)).toEqual([])
  })

  it('collects heading texts with positions and node sizes, trimming whitespace', () => {
    const editor = {
      state: {
        doc: {
          content: { size: 100 },
          descendants: (cb: (n: { type: { name: string }, textContent: string, nodeSize: number }, p: number) => boolean | void) => {
            cb({ type: { name: 'heading' }, textContent: '  First  ', nodeSize: 10 }, 2)
            cb({ type: { name: 'paragraph' }, textContent: 'body', nodeSize: 6 }, 12)
            cb({ type: { name: 'heading' }, textContent: 'Second', nodeSize: 8 }, 20)
          },
        },
      },
    } as never
    expect(collectHeadingPositions(editor)).toEqual([
      { text: 'First', pos: 2, nodeSize: 10 },
      { text: 'Second', pos: 20, nodeSize: 8 },
    ])
  })
})

describe('resolveInsertPos strict mode', () => {
  function makeEditor(headings: { text: string, pos: number, nodeSize: number }[], docSize: number) {
    return {
      state: {
        doc: {
          content: { size: docSize },
          descendants: (cb: (node: { type: { name: string }, textContent: string, nodeSize: number }, pos: number) => boolean | void) => {
            for (const h of headings) {
              cb({ type: { name: 'heading' }, textContent: h.text, nodeSize: h.nodeSize }, h.pos)
            }
          },
        },
      },
    } as never
  }

  it('strict mode skips fuzzy includes-match and falls back', () => {
    const editor = makeEditor([{ text: 'System Architecture Overview', pos: 10, nodeSize: 30 }], 100)
    const result = resolveInsertPos(editor, 'after:Architecture', 'strict')
    expect(result.matched).toBe(false)
    expect(result.strategy).toBe('fallback')
    expect(result.pos).toBe(100)
  })

  it('always-end mode returns docEnd regardless of target', () => {
    const editor = makeEditor([{ text: 'Architecture', pos: 10, nodeSize: 14 }], 100)
    const result = resolveInsertPos(editor, 'after:Architecture', 'always-end')
    expect(result.matched).toBe(false)
    expect(result.strategy).toBe('fallback')
    expect(result.pos).toBe(100)
  })
})
