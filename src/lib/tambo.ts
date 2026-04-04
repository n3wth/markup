import type { TamboComponent } from '@tambo-ai/react'
import { z } from 'zod'

import { DocumentOutline } from '../components/generative/DocumentOutline'
import { WritingAnalytics } from '../components/generative/WritingAnalytics'
import { ContentSuggestions } from '../components/generative/ContentSuggestions'
import { AgentInsights } from '../components/generative/AgentInsights'
import { ResearchResults } from '../components/generative/ResearchResults'
import { DataChart } from '../components/generative/DataChart'
import { Checklist } from '../components/generative/Checklist'
import { ComparisonTable } from '../components/generative/ComparisonTable'
import { ProgressTimeline } from '../components/generative/ProgressTimeline'
import { KeyMetrics } from '../components/generative/KeyMetrics'
import { QuoteCard } from '../components/generative/QuoteCard'
import { ActionItems } from '../components/generative/ActionItems'

const documentOutlineSchema = z.object({
  title: z.string().describe('The document title'),
  sections: z.array(
    z.object({
      heading: z.string().describe('Section heading text'),
      description: z.string().describe('Brief description of this section'),
      wordTarget: z.number().optional().describe('Target word count for this section'),
      depth: z.number().describe('Nesting depth: 0 for top-level, 1 for subsection, 2 for sub-subsection'),
    })
  ).describe('Ordered list of document sections'),
  totalWordTarget: z.number().optional().describe('Total target word count for the entire document'),
})

const writingAnalyticsSchema = z.object({
  wordCount: z.number().describe('Total word count of the document'),
  readingTimeMinutes: z.number().describe('Estimated reading time in minutes'),
  readabilityScore: z.number().describe('Readability score from 0 to 100, higher is more readable'),
  sections: z.array(
    z.object({
      name: z.string().describe('Section name'),
      wordCount: z.number().describe('Word count for this section'),
      percentage: z.number().describe('Percentage of total document this section represents'),
    })
  ).describe('Per-section word count breakdown'),
})

const contentSuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      title: z.string().describe('Short title for the suggestion'),
      description: z.string().describe('Explanation of what to do'),
      priority: z.enum(['high', 'medium', 'low']).describe('Priority level'),
      type: z.enum(['add', 'expand', 'revise', 'remove']).describe('Type of action suggested'),
    })
  ).describe('List of content improvement suggestions'),
})

const agentInsightsSchema = z.object({
  insights: z.array(
    z.object({
      agentName: z.string().describe('Agent name: Aiden, Nova, Lex, or Mira'),
      status: z.enum(['positive', 'neutral', 'concern']).describe('Agent sentiment about the document'),
      summary: z.string().describe('Brief summary of the agent perspective'),
      confidence: z.number().describe('Confidence level from 0 to 100'),
    })
  ).describe('List of per-agent insights'),
})

const researchResultsSchema = z.object({
  query: z.string().describe('The research query that was investigated'),
  results: z.array(
    z.object({
      title: z.string().describe('Result title'),
      snippet: z.string().describe('Key excerpt or finding'),
      relevance: z.number().describe('Relevance score from 0 to 100'),
      source: z.string().optional().describe('Source attribution'),
    })
  ).describe('Ordered list of research results'),
  summary: z.string().optional().describe('Brief synthesis of all results'),
})

const checklistSchema = z.object({
  title: z.string().describe('Checklist title or heading'),
  items: z.array(
    z.object({
      text: z.string().describe('The checklist item text'),
      checked: z.boolean().describe('Whether the item is checked/completed'),
      priority: z.enum(['critical', 'important', 'nice-to-have']).optional().describe('Priority level: critical (red), important (yellow), nice-to-have (green)'),
    })
  ).describe('Ordered list of checklist items'),
})

const comparisonTableSchema = z.object({
  title: z.string().describe('Comparison table title'),
  columns: z.array(
    z.object({
      name: z.string().describe('Column name (option being compared)'),
      rows: z.array(
        z.object({
          label: z.string().describe('Row label (criterion being compared)'),
          value: z.string().describe('Cell value for this column and row'),
        })
      ).describe('Array of row entries for this column'),
    })
  ).describe('Array of 2-3 columns to compare side by side'),
  highlightColumn: z.string().optional().describe('Name of the recommended column to visually highlight'),
})

const progressTimelineSchema = z.object({
  title: z.string().describe('Timeline title'),
  phases: z.array(
    z.object({
      name: z.string().describe('Phase name'),
      description: z.string().describe('Brief description of what this phase involves'),
      status: z.enum(['done', 'current', 'upcoming']).describe('Phase status: done (green), current (blue), upcoming (grey)'),
    })
  ).describe('Ordered list of timeline phases'),
})

const keyMetricsSchema = z.object({
  title: z.string().optional().describe('Optional title above the metrics grid'),
  metrics: z.array(
    z.object({
      label: z.string().describe('Metric label (e.g. "Revenue", "Users")'),
      value: z.string().describe('Formatted metric value (e.g. "$1.2M", "4,521")'),
      change: z.string().optional().describe('Change description (e.g. "+12%", "-3 pts")'),
      trend: z.enum(['up', 'down', 'neutral']).optional().describe('Trend direction for the change indicator'),
    })
  ).describe('Array of key metrics to display in a grid'),
})

const quoteCardSchema = z.object({
  quote: z.string().describe('The quote, excerpt, or callout text'),
  source: z.string().optional().describe('Attribution or source of the quote'),
  context: z.string().optional().describe('Additional context explaining why this quote matters'),
  type: z.enum(['highlight', 'warning', 'question', 'insight']).describe('Quote type: highlight (blue), warning (red), question (yellow), insight (green)'),
})

const actionItemsSchema = z.object({
  title: z.string().optional().describe('Optional title above the action items list'),
  items: z.array(
    z.object({
      action: z.string().describe('Description of the action to take'),
      owner: z.string().optional().describe('Person or agent responsible for this action'),
      status: z.enum(['todo', 'in-progress', 'done']).describe('Current status of the action item'),
      priority: z.enum(['high', 'medium', 'low']).optional().describe('Priority level: high (red dot), medium (yellow dot), low (green dot)'),
    })
  ).describe('Ordered list of action items'),
})

export const tamboComponents: TamboComponent[] = [
  {
    name: 'DocumentOutline',
    description: 'ALWAYS use this component when the user asks about document structure, outline, sections, table of contents, or organization. Renders a visual outline with nested sections. Prefer this over text responses for any outline-related request.',
    component: DocumentOutline,
    propsSchema: documentOutlineSchema,
  },
  {
    name: 'WritingAnalytics',
    description: 'ALWAYS use this component when the user asks about writing stats, analytics, word count, reading time, readability, or section balance. Renders a visual dashboard. Prefer this over text for any stats request.',
    component: WritingAnalytics,
    propsSchema: writingAnalyticsSchema,
  },
  {
    name: 'ContentSuggestions',
    description: 'ALWAYS use this component when the user asks for suggestions, improvements, feedback, what to work on, or content gaps. Renders a visual suggestion list. Prefer this over text for any improvement request.',
    component: ContentSuggestions,
    propsSchema: contentSuggestionsSchema,
  },
  {
    name: 'AgentInsights',
    description: 'ALWAYS use this component when the user asks what agents think, for agent perspectives, team feedback, or group opinions. Renders a visual agent dashboard. Prefer this over text for any agent insight request.',
    component: AgentInsights,
    propsSchema: agentInsightsSchema,
  },
  {
    name: 'ResearchResults',
    description: 'Displays structured research results with relevance scores, snippets, and optional sources. Use when the user asks to research a topic, find references, or gather background information.',
    component: ResearchResults,
    propsSchema: researchResultsSchema,
  },
  {
    name: 'DataChart',
    description: 'ALWAYS use this component when the user asks to visualize data, show a chart, graph, plot, or any numerical comparison. Renders bar charts or horizontal bar charts. Prefer this over text tables or code blocks for any data visualization.',
    component: DataChart,
    propsSchema: z.object({
      title: z.string().describe('Chart title'),
      data: z.array(z.object({
        label: z.string().describe('Data point label (e.g. year, category name)'),
        value: z.number().describe('Numeric value'),
      })).describe('Array of data points to chart'),
      type: z.enum(['bar', 'horizontal-bar']).describe('Chart type: bar for vertical columns, horizontal-bar for horizontal bars'),
      unit: z.string().optional().describe('Unit suffix shown after values (e.g. "B", "%", "ms")'),
      caption: z.string().optional().describe('Optional caption below the chart'),
    }),
  },
  {
    name: 'Checklist',
    description: 'ALWAYS use this component when the user asks for a checklist, pre-publish review, task list, readiness check, QA list, or any set of items that need to be checked off. Renders a visual checklist with priority-colored indicators and strikethrough for completed items.',
    component: Checklist,
    propsSchema: checklistSchema,
  },
  {
    name: 'ComparisonTable',
    description: 'ALWAYS use this component when the user asks to compare options, evaluate alternatives, weigh pros and cons side by side, or needs a decision matrix. Renders a compact comparison table with optional column highlighting for the recommended choice.',
    component: ComparisonTable,
    propsSchema: comparisonTableSchema,
  },
  {
    name: 'ProgressTimeline',
    description: 'ALWAYS use this component when the user asks about project phases, timelines, milestones, roadmaps, progress tracking, or status of a multi-step process. Renders a vertical timeline with color-coded phase indicators.',
    component: ProgressTimeline,
    propsSchema: progressTimelineSchema,
  },
  {
    name: 'KeyMetrics',
    description: 'ALWAYS use this component when the user asks for key metrics, KPIs, stats overview, performance numbers, or a dashboard summary. Renders a compact grid of metric cards with trend indicators.',
    component: KeyMetrics,
    propsSchema: keyMetricsSchema,
  },
  {
    name: 'QuoteCard',
    description: 'ALWAYS use this component when the user asks to highlight a quote, excerpt, callout, key passage, warning, or question from the document. Renders a styled card with a color-coded left border based on the type of callout.',
    component: QuoteCard,
    propsSchema: quoteCardSchema,
  },
  {
    name: 'ActionItems',
    description: 'ALWAYS use this component when the user asks for action items, next steps, task assignments, follow-ups, or a to-do list with owners and statuses. Renders a compact list with status badges and priority indicators.',
    component: ActionItems,
    propsSchema: actionItemsSchema,
  },
]
