import { describe, expect, it } from 'vitest'
import { analyzeSignal, sampleSignals, stableStringify } from './agoraAgent'

describe('agora agent', () => {
  it('turns a Mandarin macro signal into an Arc-ready market brief', async () => {
    const brief = await analyzeSignal(sampleSignals[0])

    expect(brief.sourceLanguage).toBe('Mandarin Chinese')
    expect(brief.category).toBe('macro policy')
    expect(brief.translatedThesis).toContain('Chinese macro policy desks')
    expect(brief.marketQuestion).not.toMatch(/[\u4e00-\u9fff]/)
    expect(brief.marketQuestion).not.toContain('Hon"')
    expect(brief.marketQuestion).toMatch(/\?$/)
    expect(brief.probability).toBeGreaterThanOrEqual(18)
    expect(brief.probability).toBeLessThanOrEqual(82)
    expect(brief.evidencePacket.chainId).toBe(5042002)
    expect(brief.evidencePacket.settlementAsset).toBe('USDC')
    expect(brief.evidencePacket.traceHash).toMatch(/^0x[a-f0-9]{64}$/)
  })

  it('classifies leaderboard migration as social trading intelligence', async () => {
    const brief = await analyzeSignal(sampleSignals[1])

    expect(brief.category).toBe('social trading intelligence')
    expect(brief.confidence).toBe('high')
    expect(brief.nextActions).toContain('Map the thesis to a liquid venue, index, or oracle-backed data feed.')
  })

  it('binds imported rationale to deduped source URLs and timestamps', async () => {
    const brief = await analyzeSignal({
      id: 'imported-signal',
      receivedAt: '2026-05-15T01:10:00.000Z',
      source: 'research',
      sourceLabel: 'Imported desk note',
      sources: [
        {
          capturedAt: '2026-05-15T01:10:00.000Z',
          publishedAt: '2026-05-15T01:00:00.000Z',
          sourceType: 'research',
          title: 'Imported desk note',
          url: 'https://research.example.com/note?utm_source=x&id=1#frag',
        },
        {
          capturedAt: '2026-05-15T01:11:00.000Z',
          sourceType: 'research',
          title: 'Duplicate desk note',
          url: 'https://research.example.com/note?id=1',
        },
      ],
      text: 'Multiple market desks expect an Arc trading agent announcement next week.',
      title: 'Imported signal',
    })

    expect(brief.sourceReferences).toHaveLength(1)
    expect(brief.sourceReferences[0]).toMatchObject({
      publishedAt: '2026-05-15T01:00:00.000Z',
      title: 'Imported desk note',
      url: 'https://research.example.com/note?id=1',
    })
    expect(brief.rationaleSources).toHaveLength(brief.rationale.length)
    expect(brief.rationaleSources[0]).toMatchObject({
      rationale: brief.rationale[0],
      sourceTitle: 'Imported desk note',
      sourceUrl: 'https://research.example.com/note?id=1',
    })
    expect(brief.evidencePacket.payload.sourceReferences).toEqual(brief.sourceReferences)
  })

  it('serializes evidence payloads with stable key ordering', () => {
    const left = stableStringify({ b: 2, a: { y: true, x: ['one', 'two'] } })
    const right = stableStringify({ a: { x: ['one', 'two'], y: true }, b: 2 })

    expect(left).toBe(right)
  })
})
