import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createBriefArchive,
  getBriefArchive,
  listBriefArchives,
  validateBriefArchiveInput,
} from './briefStore.mjs'

let dataDir

const signal = {
  id: 'test-signal',
  title: 'Test signal',
  source: 'manual',
  sourceLabel: 'Test harness',
  receivedAt: '2026-05-14T12:00:00.000Z',
  text: 'A public source suggests a market-moving policy decision next week.',
}

const brief = {
  id: 'test-signal',
  headline: 'Test signal',
  category: 'macro policy',
  sourceLanguage: 'English',
  translatedThesis: 'A public source suggests a market-moving policy decision next week.',
  marketQuestion: 'Will the policy decision move markets above 60% YES within 7 days?',
  probability: 61,
  confidence: 'medium',
  timeframe: '7 days',
  contractSketch: {
    yes: 'YES resolves if the event trades above the threshold.',
    no: 'NO resolves if it does not.',
    resolution: 'Use timestamped public market data and the archived source.',
    invalid: 'Invalidate if no objective source can be mapped.',
  },
  rationale: ['The signal has a specific policy window.', 'The source includes timing and direction.'],
  riskFlags: ['Source confidence is not final.'],
  nextActions: ['Find two independent sources.', 'Freeze the evidence packet hash.'],
  agentSteps: [
    { detail: 'Normalized the raw signal.', label: 'Ingest', status: 'complete' },
    { detail: 'Prepared a trace packet.', label: 'Settle', status: 'watch' },
  ],
  evidencePacket: {
    network: 'Arc Testnet',
    chainId: 5042002,
    settlementAsset: 'USDC',
    traceHash: `0x${'a'.repeat(64)}`,
    storagePlan: 'Pin full trace JSON offchain and anchor the digest later.',
    payload: {
      agent: 'test',
      confidence: 'medium',
      generatedAt: '2026-05-14T12:00:00.000Z',
      marketQuestion: 'Will the policy decision move markets above 60% YES within 7 days?',
      probability: 61,
      rationale: ['The signal has a specific policy window.'],
      resolution: 'Use timestamped public market data and the archived source.',
      signalId: 'test-signal',
    },
  },
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'agora-lens-'))
})

afterEach(async () => {
  await rm(dataDir, { force: true, recursive: true })
})

describe('brief archive store', () => {
  it('saves and retrieves a brief archive by ID', async () => {
    const record = await createBriefArchive(
      { appVersion: '0.2.0', brief, signal },
      { dataDir, id: 'brief_test_001', now: new Date('2026-05-14T12:30:00.000Z') },
    )

    const saved = await getBriefArchive(record.id, { dataDir })

    expect(saved.id).toBe('brief_test_001')
    expect(saved.createdAt).toBe('2026-05-14T12:30:00.000Z')
    expect(saved.signal.text).toBe(signal.text)
    expect(saved.brief.evidencePacket.traceHash).toBe(brief.evidencePacket.traceHash)
  })

  it('lists the newest brief archive summaries first', async () => {
    await createBriefArchive(
      { brief, signal },
      { dataDir, id: 'brief_old', now: new Date('2026-05-14T12:00:00.000Z') },
    )
    await createBriefArchive(
      { brief: { ...brief, headline: 'Newer signal' }, signal },
      { dataDir, id: 'brief_new', now: new Date('2026-05-14T13:00:00.000Z') },
    )

    const summaries = await listBriefArchives({ dataDir, limit: 10 })

    expect(summaries.map((summary) => summary.id)).toEqual(['brief_new', 'brief_old'])
    expect(summaries[0]).toMatchObject({
      headline: 'Newer signal',
      marketQuestion: brief.marketQuestion,
      probability: brief.probability,
    })
  })

  it('rejects malformed archive input', () => {
    expect(() => validateBriefArchiveInput({ brief, signal: { ...signal, text: '' } })).toThrow(
      'signal.text is required',
    )

    expect(() =>
      validateBriefArchiveInput({
        brief: { ...brief, evidencePacket: { ...brief.evidencePacket, traceHash: 'nope' } },
        signal,
      }),
    ).toThrow('brief.evidencePacket.traceHash must be a supported digest')
  })

  it('accepts local fallback digests for non-HTTPS demo environments', () => {
    expect(() =>
      validateBriefArchiveInput({
        brief: {
          ...brief,
          evidencePacket: { ...brief.evidencePacket, traceHash: `0xfallback${'1'.repeat(56)}` },
        },
        signal,
      }),
    ).not.toThrow()
  })

  it('rejects incomplete briefs that would break shared-link rendering', () => {
    expect(() =>
      validateBriefArchiveInput({
        brief: { ...brief, rationale: [] },
        signal,
      }),
    ).toThrow('brief.rationale must be a non-empty string array')
  })

  it('accepts imported source references and rationale bindings', () => {
    expect(() =>
      validateBriefArchiveInput({
        brief: {
          ...brief,
          rationaleSources: [
            {
              capturedAt: '2026-05-14T12:00:00.000Z',
              rationale: brief.rationale[0],
              sourceTitle: 'Imported source',
              sourceUrl: 'https://example.com/story',
            },
          ],
          sourceReferences: [
            {
              capturedAt: '2026-05-14T12:00:00.000Z',
              sourceType: 'url',
              title: 'Imported source',
              url: 'https://example.com/story',
            },
          ],
        },
        signal: {
          ...signal,
          sources: [
            {
              capturedAt: '2026-05-14T12:00:00.000Z',
              sourceType: 'url',
              title: 'Imported source',
              url: 'https://example.com/story',
            },
          ],
        },
      }),
    ).not.toThrow()
  })
})
