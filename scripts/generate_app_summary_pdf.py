from pathlib import Path

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / 'output' / 'pdf' / 'markup-app-summary.pdf'

PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN = 40
HEADER_GAP = 18
SECTION_GAP = 14
ITEM_GAP = 5
FOOTER_GAP = 26

COL_GAP = 18
LEFT_COL_W = 185
RIGHT_COL_W = PAGE_WIDTH - (MARGIN * 2) - LEFT_COL_W - COL_GAP

BG = white
TEXT = HexColor('#111827')
MUTED = HexColor('#4b5563')
LINE = HexColor('#d1d5db')
ACCENT = HexColor('#0f766e')
PANEL = HexColor('#f8fafc')


TITLE = 'Markup'
SUBTITLE = 'One-page app summary based on repo evidence'

WHAT_IT_IS = (
  'Markup is a real-time collaborative writing workspace where people and AI agents '
  'work in the same document and chat. The repo also includes a Tambo assistant that '
  'answers slash commands with structured generative UI components.'
)

WHO_ITS_FOR = (
  'Primary user: someone drafting product briefs, technical specs, design reviews, or '
  'meeting notes who wants AI reviewers with engineering, product, legal, and design perspectives.'
)

WHAT_IT_DOES = [
  'Rich text editing in Tiptap with live agent cursors, states, and thought bubbles.',
  'Configurable agent team with four named personas: Aiden, Nova, Lex, and Mira.',
  'Chat-driven collaboration with natural language prompts, @mentions, and direct agent replies.',
  'Tambo slash commands for outlines, analytics, suggestions, research, checklists, timelines, tables, and metrics.',
  'Session persistence for documents, chat history, and agent personas in Supabase.',
  'Starter flows for blank docs, PRDs, tech specs, design reviews, meeting notes, and a demo brief.',
  'Google Docs import plus proactive heartbeat and wizard-of-oz observations between user turns.',
]

HOW_IT_WORKS = [
  'UI layer: React 19 + Vite app (`src/main.tsx`, `src/App.tsx`) hosts the editor, chat, session UI, auth, analytics, and Tambo provider.',
  'Agent loop: `orchestrator.ts` queues one agent at a time, `agent.ts` builds prompts and calls `/api/gemini`, and `agent-actions.ts` applies insert/replace/read/chat actions.',
  'Proactive behaviors: `wizard-of-oz.ts` adds scripted observations and `heartbeat.ts` can trigger LLM-based follow-up turns.',
  'Data/services: Supabase stores sessions, documents, chat messages, and agent personas; Google OAuth is used for auth and Drive import; Vite dev middleware proxies Gemini calls.',
  'Flow: user chat or doc edits trigger the orchestrator, Gemini returns a structured action, the editor mutates, and saves are debounced back to Supabase.',
]

HOW_TO_RUN = [
  '`npm install`',
  'Create `.env.local` with `GEMINI_API_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`.',
  'Run `npm run dev`.',
  'Open `http://localhost:5173` in a browser. Sign in with Google only if you need Drive import.',
]

SOURCES = (
  'Repo evidence used: CLAUDE.md, README.md, src/App.tsx, src/main.tsx, src/orchestrator.ts, '
  'src/agent.ts, src/wizard-of-oz.ts, src/lib/session-store.ts, src/lib/supabase.ts, '
  'src/lib/tambo.ts, src/hooks/useSession.ts, src/TemplatePickerModal.tsx, vite.config.ts, '
  'supabase/migrations/001_initial_schema.sql'
)


BODY = ParagraphStyle(
  'Body',
  fontName='Helvetica',
  fontSize=8.6,
  leading=10.7,
  textColor=TEXT,
)

BODY_SMALL = ParagraphStyle(
  'BodySmall',
  parent=BODY,
  fontSize=8.0,
  leading=10.0,
)

SECTION = ParagraphStyle(
  'Section',
  fontName='Helvetica-Bold',
  fontSize=9.2,
  leading=11,
  textColor=ACCENT,
)

TITLE_STYLE = ParagraphStyle(
  'Title',
  fontName='Helvetica-Bold',
  fontSize=21,
  leading=23,
  textColor=TEXT,
)

SUBTITLE_STYLE = ParagraphStyle(
  'Subtitle',
  fontName='Helvetica',
  fontSize=8.6,
  leading=10,
  textColor=MUTED,
)

FOOTER = ParagraphStyle(
  'Footer',
  fontName='Helvetica',
  fontSize=6.7,
  leading=8.1,
  textColor=MUTED,
)


def draw_paragraph(pdf: canvas.Canvas, text: str, style: ParagraphStyle, x: float, y: float, width: float) -> float:
  para = Paragraph(text, style)
  _, height = para.wrap(width, PAGE_HEIGHT)
  para.drawOn(pdf, x, y - height)
  return y - height


def draw_section_title(pdf: canvas.Canvas, title: str, x: float, y: float, width: float) -> float:
  y = draw_paragraph(pdf, title.upper(), SECTION, x, y, width)
  y -= 5
  pdf.setStrokeColor(LINE)
  pdf.setLineWidth(1)
  pdf.line(x, y, x + width, y)
  return y - 8


def draw_bullets(pdf: canvas.Canvas, items: list[str], x: float, y: float, width: float, style: ParagraphStyle) -> float:
  for item in items:
    y = draw_paragraph(pdf, f'- {item}', style, x, y, width)
    y -= ITEM_GAP
  return y


def draw_steps(pdf: canvas.Canvas, items: list[str], x: float, y: float, width: float) -> float:
  for index, item in enumerate(items, start=1):
    y = draw_paragraph(pdf, f'{index}. {item}', BODY_SMALL, x, y, width)
    y -= ITEM_GAP
  return y


def ensure_single_page_fit() -> None:
  test_lines = simpleSplit(SOURCES, FOOTER.fontName, FOOTER.fontSize, PAGE_WIDTH - (MARGIN * 2))
  footer_height = len(test_lines) * FOOTER.leading
  usable_height = PAGE_HEIGHT - MARGIN - FOOTER_GAP - footer_height
  if usable_height <= 0:
    raise RuntimeError('Footer content does not fit on the page')


def build_pdf() -> Path:
  ensure_single_page_fit()
  OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

  pdf = canvas.Canvas(str(OUTPUT_PATH), pagesize=letter)
  pdf.setTitle('Markup app summary')
  pdf.setAuthor('OpenAI Codex')
  pdf.setSubject('One-page summary based on repository evidence')

  pdf.setFillColor(BG)
  pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)

  left_x = MARGIN
  right_x = MARGIN + LEFT_COL_W + COL_GAP
  top_y = PAGE_HEIGHT - MARGIN

  pdf.setFillColor(PANEL)
  pdf.rect(MARGIN, PAGE_HEIGHT - 120, PAGE_WIDTH - (MARGIN * 2), 80, stroke=0, fill=1)

  y = top_y
  y = draw_paragraph(pdf, TITLE, TITLE_STYLE, MARGIN + 14, y - 10, PAGE_WIDTH - (MARGIN * 2) - 28)
  y = draw_paragraph(pdf, SUBTITLE, SUBTITLE_STYLE, MARGIN + 14, y - 4, PAGE_WIDTH - (MARGIN * 2) - 28)

  left_y = PAGE_HEIGHT - 136
  right_y = PAGE_HEIGHT - 136

  left_y = draw_section_title(pdf, 'What it is', left_x, left_y, LEFT_COL_W)
  left_y = draw_paragraph(pdf, WHAT_IT_IS, BODY, left_x, left_y, LEFT_COL_W)
  left_y -= SECTION_GAP

  left_y = draw_section_title(pdf, 'Who it is for', left_x, left_y, LEFT_COL_W)
  left_y = draw_paragraph(pdf, WHO_ITS_FOR, BODY, left_x, left_y, LEFT_COL_W)
  left_y -= SECTION_GAP

  left_y = draw_section_title(pdf, 'How to run', left_x, left_y, LEFT_COL_W)
  left_y = draw_steps(pdf, HOW_TO_RUN, left_x, left_y, LEFT_COL_W)

  right_y = draw_section_title(pdf, 'What it does', right_x, right_y, RIGHT_COL_W)
  right_y = draw_bullets(pdf, WHAT_IT_DOES, right_x, right_y, RIGHT_COL_W, BODY_SMALL)
  right_y -= SECTION_GAP - 4

  right_y = draw_section_title(pdf, 'How it works', right_x, right_y, RIGHT_COL_W)
  right_y = draw_bullets(pdf, HOW_IT_WORKS, right_x, right_y, RIGHT_COL_W, BODY_SMALL)

  footer_y = MARGIN + 8
  draw_paragraph(pdf, SOURCES, FOOTER, MARGIN, footer_y + 18, PAGE_WIDTH - (MARGIN * 2))

  min_y = min(left_y, right_y)
  if min_y < 72:
    raise RuntimeError(f'Content overflowed the page layout (min y = {min_y:.1f})')

  pdf.showPage()
  pdf.save()
  return OUTPUT_PATH


if __name__ == '__main__':
  path = build_pdf()
  print(path)
