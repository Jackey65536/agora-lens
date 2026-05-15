import { describe, expect, it } from 'vitest'

import {
  buildOperatorPrompt,
  generateBriefDraft,
  validateBriefDraft,
  validateGenerateInput,
} from './llmBriefGenerator.mjs'

const signal = {
  id: 'arc-signal',
  receivedAt: '2026-05-15T08:00:00.000Z',
  source: 'research',
  sourceLabel: 'Imported research',
  sources: [
    {
      capturedAt: '2026-05-15T08:00:00.000Z',
      excerpt: 'Arc agents are preparing public market experiments.',
      sourceType: 'research',
      title: 'Arc agent note',
      url: 'https://research.example.com/arc-agent-note',
    },
  ],
  text:
    'Multiple market desks expect Arc stablecoin-native trading agents to launch public prediction-market experiments next week.',
  title: 'Arc agent note',
}

const validDraft = {
  confidence: 'medium',
  headline: 'Arc agent prediction-market experiments',
  marketQuestion:
    'Will at least one public Arc-native trading agent prediction-market experiment launch by May 22, 2026?',
  nextActions: [
    'Confirm whether the launch announcement comes from an official project account.',
    'Archive a second independent source before publishing.',
  ],
  probability: 62,
  rationale: [
    'Multiple desks independently point to the same one-week launch window.',
    'The signal names a concrete venue class and public experiment outcome.',
    'The source still needs official confirmation before settlement language is final.',
  ],
  sourceLanguage: 'English',
  timeframe: '7 days',
  translatedThesis:
    'Market desks expect Arc-native trading agents to launch public prediction-market experiments within one week.',
}

describe('LLM brief generator', () => {
  it('rejects malformed generate requests at the boundary', () => {
    expect(() => validateGenerateInput({ signal: { ...signal, text: '' } })).toThrow(
      'signal.text is required',
    )
  })

  it('validates LLM drafts against the market schema', () => {
    expect(validateBriefDraft(validDraft)).toEqual(validDraft)

    expect(() =>
      validateBriefDraft({
        ...validDraft,
        confidence: 'certain',
      }),
    ).toThrow('draft.confidence must be low, medium, or high')

    expect(() =>
      validateBriefDraft({
        ...validDraft,
        probability: 101,
      }),
    ).toThrow('draft.probability must be between 0 and 100')
  })

  it('returns an operator prompt and deterministic fallback when no API key is configured', async () => {
    const result = await generateBriefDraft(
      { signal },
      {
        apiKey: '',
        now: new Date('2026-05-15T08:05:00.000Z'),
      },
    )

    expect(result.mode).toBe('fallback')
    expect(result.reason).toBe('LLM generator is not configured on this server.')
    expect(result.operatorPrompt).toContain('Manual review prompt')
    expect(result.operatorPrompt).toContain(signal.title)
  })

  it('calls the OpenAI Responses API with strict JSON schema and validates the returned draft', async () => {
    const requests = []
    const result = await generateBriefDraft(
      { signal },
      {
        apiKey: 'test-key',
        callModel: async (request) => {
          requests.push(request)
          return { output_text: JSON.stringify(validDraft) }
        },
        model: 'gpt-test',
        now: new Date('2026-05-15T08:05:00.000Z'),
      },
    )

    expect(result.mode).toBe('llm')
    expect(result.draft).toEqual(validDraft)
    expect(result.model).toBe('gpt-test')
    expect(requests[0].text.format).toMatchObject({
      name: 'agora_market_brief_draft',
      strict: true,
      type: 'json_schema',
    })
    expect(requests[0].input).toContain(signal.text)
  })

  it('falls back with a human prompt when the model response fails schema validation', async () => {
    const result = await generateBriefDraft(
      { signal },
      {
        apiKey: 'test-key',
        callModel: async () => ({ output_text: JSON.stringify({ ...validDraft, rationale: [] }) }),
        now: new Date('2026-05-15T08:05:00.000Z'),
      },
    )

    expect(result.mode).toBe('fallback')
    expect(result.reason).toBe('draft.rationale must contain 2 to 6 strings')
    expect(result.operatorPrompt).toBe(buildOperatorPrompt(signal, result.reason))
  })
})
