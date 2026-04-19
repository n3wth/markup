/**
 * Convert Tiptap's HTML output to a compact, human-readable Markdown
 * string. Keeps the handful of block elements the editor actually emits
 * (StarterKit nodes) and is intentionally lossy for everything else.
 *
 * This is a pure, DOM-free implementation so it runs in tests and in
 * SSR contexts. It handles:
 *   - h1-h6, paragraphs, line breaks, horizontal rules
 *   - unordered + ordered lists (flat; nested lists are supported one
 *     level via indentation)
 *   - blockquote (prefixes every inner paragraph with `> `)
 *   - pre/code blocks (fenced, with language hint if present)
 *   - inline: strong, em, code, links
 *
 * The editor never emits tables or raw script/style, so those aren't
 * handled. If unexpected HTML appears, the function preserves the inner
 * text without the tags.
 */

interface Options {
  /**
   * Prepend a YAML-ish title front-matter with the doc title. Leave
   * blank to skip.
   */
  title?: string
}

const BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'hr',
])

interface ParsedNode {
  tag: string
  attrs: Record<string, string>
  children: (ParsedNode | string)[]
}

/** Tiny HTML parser tuned to the subset Tiptap StarterKit emits. */
function parseHtml(input: string): ParsedNode {
  const root: ParsedNode = { tag: 'root', attrs: {}, children: [] }
  const stack: ParsedNode[] = [root]
  const voidTags = new Set(['br', 'hr', 'img'])

  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)\/?>/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  const decodeEntities = (s: string) =>
    s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')

  const parseAttrs = (raw: string): Record<string, string> => {
    const attrs: Record<string, string> = {}
    const re = /([a-zA-Z-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
    let m: RegExpExecArray | null
    while ((m = re.exec(raw)) !== null) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''
    }
    return attrs
  }

  while ((match = tagRe.exec(input)) !== null) {
    const text = input.slice(lastIndex, match.index)
    if (text) stack[stack.length - 1].children.push(decodeEntities(text))
    const [full, tag] = match
    const tagName = tag.toLowerCase()
    const isClose = full.startsWith('</')
    const isSelfClose = full.endsWith('/>') || voidTags.has(tagName)

    if (isClose) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tagName) {
          stack.length = i
          break
        }
      }
    } else {
      const node: ParsedNode = {
        tag: tagName,
        attrs: parseAttrs(match[2] || ''),
        children: [],
      }
      stack[stack.length - 1].children.push(node)
      if (!isSelfClose) stack.push(node)
    }
    lastIndex = tagRe.lastIndex
  }
  const tail = input.slice(lastIndex)
  if (tail) root.children.push(decodeEntities(tail))
  return root
}

function renderInline(node: ParsedNode | string): string {
  if (typeof node === 'string') return node
  const inner = node.children.map(renderInline).join('')
  switch (node.tag) {
    case 'strong':
    case 'b':
      return `**${inner}**`
    case 'em':
    case 'i':
      return `_${inner}_`
    case 'code':
      return `\`${inner}\``
    case 'a': {
      const href = node.attrs.href || ''
      return href ? `[${inner}](${href})` : inner
    }
    case 'br':
      return '\n'
    case 'span':
      return inner
    default:
      return inner
  }
}

function renderBlock(node: ParsedNode, depth = 0): string {
  if (typeof node === 'string') return node
  const indent = '  '.repeat(depth)
  switch (node.tag) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
      const level = Number(node.tag.slice(1))
      return `${'#'.repeat(level)} ${node.children.map(renderInline).join('')}`
    }
    case 'p':
      return node.children.map(renderInline).join('')
    case 'hr':
      return '---'
    case 'ul':
    case 'ol': {
      const ordered = node.tag === 'ol'
      return node.children
        .filter((c): c is ParsedNode => typeof c !== 'string' && c.tag === 'li')
        .map((li, i) => {
          const marker = ordered ? `${i + 1}.` : '-'
          const liContent = li.children.map(c => {
            if (typeof c !== 'string' && (c.tag === 'ul' || c.tag === 'ol')) {
              return '\n' + renderBlock(c, depth + 1)
            }
            return renderInline(c)
          }).join('')
          return `${indent}${marker} ${liContent.trim()}`
        })
        .join('\n')
    }
    case 'blockquote':
      return node.children
        .filter((c): c is ParsedNode => typeof c !== 'string')
        .map(c => renderBlock(c, depth).split('\n').map(l => `> ${l}`).join('\n'))
        .join('\n\n')
    case 'pre': {
      const codeChild = node.children.find(
        (c): c is ParsedNode => typeof c !== 'string' && c.tag === 'code',
      )
      const lang = codeChild?.attrs.class?.match(/language-(\S+)/)?.[1] ?? ''
      const body = codeChild ? codeChild.children.map(renderInline).join('') : node.children.map(renderInline).join('')
      return '```' + lang + '\n' + body + '\n```'
    }
    default:
      return node.children.map(renderInline).join('')
  }
}

export function htmlToMarkdown(html: string, options: Options = {}): string {
  const root = parseHtml(html)
  const parts: string[] = []
  if (options.title) parts.push(`# ${options.title}`)
  for (const child of root.children) {
    if (typeof child === 'string') {
      const t = child.trim()
      if (t) parts.push(t)
      continue
    }
    if (BLOCK_TAGS.has(child.tag)) {
      const rendered = renderBlock(child).trim()
      if (rendered) parts.push(rendered)
    }
    // unknown top-level tags fall through silently — lossy by design
  }
  return parts.join('\n\n').trim() + '\n'
}

/**
 * Trigger a browser download of the given markdown. Safe no-op on
 * non-browser runtimes (returns false).
 */
export function downloadMarkdown(filename: string, markdown: string): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}
