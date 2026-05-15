import { describe, expect, it, vi } from 'vitest'
import { generateLlmBriefDraft, type LlmBriefDraft } from './llmBrief'

const draft: LlmBriefDraft = {
  confidence: 'medium',
  headline: 'Arc agent experiments',
  marketQuestion: 'Will an Arc-native agent market launch within 7 days?',
  nextActions: ['Verify the official source.', 'Archive the source packet.'],
  probability: 63,
  rationale: [
    'The imported source includes a concrete launch window.',
    'The thesis is specific enough to become a bounded market.',
  ],
  sourceLanguage: 'English',
  timeframe: '7 days',
  translatedThesis: 'Arc-native agents may launch public market experiments within one week.',
}

const signal = {
  id: 'manual-signal',
  receivedAt: '2026-05-15T08:00:00.000Z',
  source: 'manual' as const,
  sourceLabel: 'Operator console',
  text: 'Arc-native agents may launch public market experiments within one week.',
  title: 'Manual signal',
}

describe('LLM brief API client', () => {
  it('posts a signal to the server-side generator', async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ draft, mode: 'llm', model: 'gpt-test' }),
      ok: true,
    })) as unknown as typeof fetch

    const result = await generateLlmBriefDraft(signal, { fetchImpl: fetchMock })

    expect(result.mode).toBe('llm')
    if (result.mode !== 'llm') throw new Error('expected llm result')
    expect(result.draft).toEqual(draft)
    expect(fetchMock).toHaveBeenCalledWith('/api/briefs/generate', {
      body: JSON.stringify({ signal }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
  })

  it('propagates fallback prompts instead of throwing', async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({
        mode: 'fallback',
        operatorPrompt: 'Manual review prompt: add a second source.',
        reason: 'LLM generator is not configured on this server.',
      }),
      ok: true,
    })) as unknown as typeof fetch

    const result = await generateLlmBriefDraft(signal, { fetchImpl: fetchMock })

    expect(result.mode).toBe('fallback')
    if (result.mode !== 'fallback') throw new Error('expected fallback result')
    expect(result.operatorPrompt).toContain('Manual review prompt')
  })

  it('throws API validation errors', async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ error: 'signal.text is required' }),
      ok: false,
    })) as unknown as typeof fetch

    await expect(generateLlmBriefDraft(signal, { fetchImpl: fetchMock })).rejects.toThrow(
      'signal.text is required',
    )
  })
})
