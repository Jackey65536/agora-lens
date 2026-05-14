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

  it('serializes evidence payloads with stable key ordering', () => {
    const left = stableStringify({ b: 2, a: { y: true, x: ['one', 'two'] } })
    const right = stableStringify({ a: { x: ['one', 'two'], y: true }, b: 2 })

    expect(left).toBe(right)
  })
})
