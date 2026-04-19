import { beforeEach, describe, expect, it } from 'vitest'

import { detectObservations, resetWizard } from '../wizard-of-oz'

const AGENTS = ['Aiden', 'Nova']

describe('detectObservations', () => {
  beforeEach(() => {
    resetWizard()
  })

  describe('empty-doc greeting rule', () => {
    it('fires when the doc is empty and few messages exist', () => {
      const results = detectObservations('', [], AGENTS)
      expect(results.some(r => /fresh doc/i.test(r.text))).toBe(true)
      expect(results[0].agent).toBe('Aiden')
    })

    it('does not fire when the phase is drafting (user already directed)', () => {
      const results = detectObservations('', [], AGENTS, 'drafting')
      expect(results.some(r => /fresh doc/i.test(r.text))).toBe(false)
    })

    it('does not fire once the doc has substance', () => {
      const doc = 'a'.repeat(60)
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /fresh doc/i.test(r.text))).toBe(false)
    })
  })

  describe('doc-has-content-agents-silent rule', () => {
    it('fires when doc has content but agents have not spoken twice', () => {
      const doc = 'Lorem ipsum '.repeat(40)
      const results = detectObservations(doc, [{ from: 'You', text: 'hi' }], AGENTS)
      expect(results.some(r => /good start/i.test(r.text))).toBe(true)
    })

    it('does not fire once agents have spoken twice or more', () => {
      const doc = 'Lorem ipsum '.repeat(40)
      const messages = [
        { from: 'Aiden', text: 'first' },
        { from: 'Aiden', text: 'second' },
      ]
      const results = detectObservations(doc, messages, AGENTS)
      expect(results.some(r => /good start/i.test(r.text))).toBe(false)
    })
  })

  describe('TODO detection rule', () => {
    it('fires when the doc has TODO markers', () => {
      const doc = 'This section is done. TODO: add risks. TBD: confirm numbers.'
      const results = detectObservations(doc, [], AGENTS)
      const todo = results.find(r => /TODO/.test(r.text))
      expect(todo).toBeDefined()
      expect(todo?.text).toMatch(/Found 2 TODOs/)
      expect(todo?.agent).toBe('Nova')
    })

    it('uses singular phrasing for exactly one TODO', () => {
      const doc = 'One loose end. FIXME: double-check the deadline.'
      const results = detectObservations(doc, [], AGENTS)
      const todo = results.find(r => /Found 1 TODO/.test(r.text))
      expect(todo).toBeDefined()
      expect(todo?.text).toMatch(/take a crack at it/)
    })

    it('does not fire when the doc has no TODO markers', () => {
      const doc = 'This document is complete with no outstanding items or markers.'
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /Found \d+ TODO/.test(r.text))).toBe(false)
    })
  })

  describe('thin-multi-section rule', () => {
    it('fires when several H2 headings exist but content is sparse', () => {
      const doc = '<h2>Intro</h2><p>a</p><h2>Design</h2><p>b</p><h2>Risks</h2><p>c</p>'
      const results = detectObservations(doc, [], AGENTS)
      const thin = results.find(r => /sections but most are light/.test(r.text))
      expect(thin).toBeDefined()
      expect(thin?.text).toMatch(/3 sections/)
    })

    it('does not fire when sections are substantial', () => {
      const body = 'word '.repeat(80)
      const doc = `<h2>Intro</h2><p>${body}</p><h2>Design</h2><p>${body}</p><h2>Risks</h2><p>${body}</p>`
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /sections but most are light/.test(r.text))).toBe(false)
    })
  })

  describe('open-question detection rule', () => {
    it('fires when the doc has two or more lines ending in ?', () => {
      const doc = 'Who owns this?\nWhen does it ship?\nWhat is out of scope?\n'
      const results = detectObservations(doc, [], AGENTS)
      const q = results.find(r => /open questions/.test(r.text))
      expect(q).toBeDefined()
      expect(q?.text).toMatch(/3 open questions/)
      expect(q?.agent).toBe('Aiden')
    })

    it('does not fire for a single question', () => {
      const doc = 'Is this ready?\n'
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /open questions/.test(r.text))).toBe(false)
    })
  })

  describe('timeline-without-risks rule', () => {
    it('fires when a timeline is present but risk discussion is absent', () => {
      const doc = ('We plan Q1 kickoff with a deadline in Q2 and a final review in Q3. ').repeat(10)
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /timeline but no risk analysis/.test(r.text))).toBe(true)
    })

    it('does not fire when the doc mentions mitigations', () => {
      const doc = ('We plan Q1 kickoff with a deadline in Q2. The main risk is scope creep and our mitigation is weekly check-ins. ').repeat(8)
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /timeline but no risk analysis/.test(r.text))).toBe(false)
    })
  })

  describe('agents-working-in-parallel rule', () => {
    it('fires when agents have spoken enough but never cross-reference each other', () => {
      const messages = [
        { from: 'Aiden', text: 'I drafted the intro.' },
        { from: 'Nova', text: 'Reviewed the sections.' },
        { from: 'Aiden', text: 'Added a rollout note.' },
        { from: 'Nova', text: 'Filed risks in a new section.' },
      ]
      const results = detectObservations('', messages, AGENTS)
      const parallel = results.find(r => /working in parallel instead of together/.test(r.text))
      expect(parallel).toBeDefined()
      expect(parallel?.text).toMatch(/@Nova/)
    })

    it('does not fire once an agent @-mentions another', () => {
      const messages = [
        { from: 'Aiden', text: 'I drafted the intro.' },
        { from: 'Nova', text: 'Reviewed. @aiden can you double-check?' },
        { from: 'Aiden', text: 'Added a rollout note.' },
        { from: 'Nova', text: 'Filed risks.' },
      ]
      const results = detectObservations('', messages, AGENTS)
      expect(results.some(r => /working in parallel instead of together/.test(r.text))).toBe(false)
    })
  })

  describe('vague-language rule', () => {
    it('fires when three or more vague terms appear in a substantive doc', () => {
      const doc = ('Performance has improved significantly after many various recent tweaks. ').repeat(8)
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /vague language/.test(r.text))).toBe(true)
    })

    it('does not fire on concrete specific prose', () => {
      const doc = ('Latency dropped from 820ms to 310ms after we switched to the v3 index on April 12. ').repeat(8)
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /vague language/.test(r.text))).toBe(false)
    })
  })

  describe('contradiction rule', () => {
    it('flags numeric contradictions about the same noun', () => {
      const doc = ('Overview of the plan.\n' +
        'Onboarding takes 5 minutes.\n' +
        'Launch follows in Q2.\n' +
        'Onboarding takes 30 minutes for enterprise.\n' +
        'Post launch we monitor for two weeks.\n').repeat(3)
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /contradiction/i.test(r.text))).toBe(true)
    })

    it('does not fire when no conflicting claims are present', () => {
      const doc = ('The signup flow takes two steps and then the user lands on the home view. ').repeat(10)
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /contradiction/i.test(r.text))).toBe(false)
    })
  })

  describe('disproportionate-section rule', () => {
    it('fires when one section is much shorter than the rest', () => {
      const big = 'word '.repeat(120)
      const doc = `# Intro\n${big}\n# Design\n${big}\n# Risks\nshort.\n`
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /much thinner than the rest/.test(r.text))).toBe(true)
    })

    it('does not fire when sections are evenly sized', () => {
      const body = 'word '.repeat(80)
      const doc = `# Intro\n${body}\n# Design\n${body}\n# Risks\n${body}\n`
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /much thinner than the rest/.test(r.text))).toBe(false)
    })
  })

  describe('missing-section rule', () => {
    it('fires on a PRD missing success metrics and risks', () => {
      const doc = ('# Overview\nThis product requirement document describes a new feature for the user experience. '.repeat(6))
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /missing a Success Metrics/.test(r.text))).toBe(true)
    })

    it('does not fire when the expected headings are present', () => {
      const doc = (
        '# Product Requirement\n' +
        'This document describes a user story and requirement. '.repeat(4) +
        '\n# Success Metrics\n' +
        'Measured by KPI dashboards. '.repeat(4) +
        '\n# Risks and Assumptions\n' +
        'We assume the rollout risk is contained. '.repeat(4) +
        '\n# Timeline\n' +
        'Phase 1 in Q2. Phase 2 in Q3. '.repeat(4) +
        '\n# Scope\n' +
        'In scope and out of scope items listed. '.repeat(4)
      )
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /missing a /.test(r.text))).toBe(false)
    })
  })

  describe('missing-summary rule', () => {
    it('fires when a large doc opens directly with a heading', () => {
      const body = 'word '.repeat(250)
      const headings = Array.from({ length: 15 }, (_, i) => `# Section Title Number ${i + 1}`).join('\n')
      const doc = `${headings}\n${body}`
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /without an overview/.test(r.text))).toBe(true)
    })

    it('does not fire when the doc has a summary section at the top', () => {
      const body = 'word '.repeat(120)
      const doc = `# Summary\nThis is a brief overview of what follows. ${body}\n# Details\n${body}`
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /without an overview/.test(r.text))).toBe(false)
    })
  })

  describe('passive-voice rule', () => {
    it('fires when passive constructions dominate', () => {
      const doc = (
        'The system was deployed on Monday. ' +
        'The bug was noticed by the user. ' +
        'The service is managed by the platform. ' +
        'The logs are collected centrally. ' +
        'The tests were executed overnight. ' +
        'The alert was triggered automatically. ' +
        'The changes are reviewed before release. ' +
        'The requests are processed in order. '
      ).repeat(2)
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /passive voice/i.test(r.text))).toBe(true)
    })

    it('does not fire on active-voice prose', () => {
      const doc = (
        'The team ships every Friday. ' +
        'The user opens the app and taps a card. ' +
        'The service processes the request and returns JSON. ' +
        'We write docs before we write code. ' +
        'Alerts page the on-call engineer. ' +
        'The rollout schedule spans two weeks. '
      ).repeat(2)
      const results = detectObservations(doc, [], AGENTS)
      expect(results.some(r => /passive voice/i.test(r.text))).toBe(false)
    })
  })

  describe('discovery/planning phase handling', () => {
    it('emits the low-pressure nudge when an agent has greeted but the user has not replied', () => {
      const results = detectObservations(
        '',
        [
          { from: 'Aiden', text: 'Hey, what do you want to draft?' },
          { from: 'Aiden', text: 'Let me know and I can start.' },
        ],
        AGENTS,
        'discovery',
      )
      expect(results).toHaveLength(1)
      expect(results[0].text).toMatch(/No rush/)
      expect(results[0].agent).toBe('Nova')
    })

    it('returns no observations in planning if the user has already spoken', () => {
      const results = detectObservations(
        '',
        [
          { from: 'Aiden', text: 'Hi.' },
          { from: 'You', text: 'Lets plan the rollout.' },
        ],
        AGENTS,
        'planning',
      )
      expect(results).toHaveLength(0)
    })

    it('returns no observations during discovery/planning when no agent has spoken', () => {
      const results = detectObservations('', [], AGENTS, 'discovery')
      expect(results).toHaveLength(0)
    })

    it('does not emit any drafting-phase rules while in discovery even if patterns match', () => {
      const doc = 'TODO: write everything.\nTBD: confirm.'
      const results = detectObservations(doc, [], AGENTS, 'discovery')
      expect(results.some(r => /Found \d+ TODO/.test(r.text))).toBe(false)
    })
  })

  describe('duplicate suppression', () => {
    it('suppresses the same observation across adjacent ticks', () => {
      const doc = 'TODO: confirm deadline.'
      const first = detectObservations(doc, [], AGENTS)
      const second = detectObservations(doc, [], AGENTS)
      const match = (r: { text: string }) => /Found 1 TODO/.test(r.text)
      expect(first.some(match)).toBe(true)
      expect(second.some(match)).toBe(false)
    })

    it('does not suppress an observation with different text', () => {
      const firstDoc = 'TODO: confirm deadline.'
      const secondDoc = 'TODO: confirm deadline. TBD: confirm owner.'
      const first = detectObservations(firstDoc, [], AGENTS)
      const second = detectObservations(secondDoc, [], AGENTS)
      expect(first.some(r => /Found 1 TODO/.test(r.text))).toBe(true)
      expect(second.some(r => /Found 2 TODOs/.test(r.text))).toBe(true)
    })

    it('resetWizard clears the suppression memory', () => {
      const doc = 'TODO: confirm deadline.'
      const first = detectObservations(doc, [], AGENTS)
      const suppressed = detectObservations(doc, [], AGENTS)
      resetWizard()
      const afterReset = detectObservations(doc, [], AGENTS)
      expect(first.some(r => /Found 1 TODO/.test(r.text))).toBe(true)
      expect(suppressed.some(r => /Found 1 TODO/.test(r.text))).toBe(false)
      expect(afterReset.some(r => /Found 1 TODO/.test(r.text))).toBe(true)
    })
  })

  describe('observation shape', () => {
    it('always returns a delay on emitted observations', () => {
      const doc = 'TODO: confirm.'
      const results = detectObservations(doc, [], AGENTS)
      for (const r of results) {
        expect(r.type).toBe('chat')
        expect(typeof r.delay).toBe('number')
        expect(r.delay).toBeGreaterThan(0)
        expect(AGENTS).toContain(r.agent)
      }
    })

    it('routes the TODO observation to the second agent when two are present', () => {
      const doc = 'TODO: confirm.'
      const results = detectObservations(doc, [], AGENTS)
      const todo = results.find(r => /Found 1 TODO/.test(r.text))
      expect(todo?.agent).toBe('Nova')
    })

    it('falls back to the single agent when only one is configured', () => {
      const doc = 'TODO: confirm.'
      const results = detectObservations(doc, [], ['Aiden'])
      const todo = results.find(r => /Found 1 TODO/.test(r.text))
      expect(todo?.agent).toBe('Aiden')
    })
  })
})
