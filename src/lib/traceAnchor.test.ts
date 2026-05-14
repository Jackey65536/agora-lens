import { describe, expect, it } from 'vitest'

import type { MarketBrief, MarketSignal } from './agoraAgent'
import {
  createAnchorDraft,
  encodeAnchorTraceCall,
  sendAnchorTransaction,
  sendDeployTransaction,
  TRACE_ANCHOR_METHOD_ID,
  txExplorerUrl,
} from './traceAnchor'
import type { Eip1193Provider } from './wallet'

const account = '0x1234567890abcdef1234567890abcdef12345678'
const contractAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
const traceHash = `0x${'a'.repeat(64)}` as const

const signal = {
  id: 'mandarin-macro',
  receivedAt: '2026-05-14T08:40:00.000Z',
  source: 'news',
  sourceLabel: 'Chinese market desk note',
  text: 'test',
  title: 'Mandarin macro signal',
} satisfies MarketSignal

const brief = {
  evidencePacket: {
    traceHash,
  },
} as MarketBrief

describe('TraceAnchor transaction helpers', () => {
  it('builds a signing draft from the current brief and share URL', () => {
    const draft = createAnchorDraft({
      account,
      brief,
      contractAddress,
      signal,
      uri: 'http://60.204.151.206:18080/?brief=brief_1',
    })

    expect(draft.traceHash).toBe(traceHash)
    expect(draft.signalIdHash).toMatch(/^0x[a-f0-9]{64}$/)
    expect(draft.uri).toContain('brief_1')
  })

  it('encodes anchorTrace(bytes32,bytes32,string) calldata', () => {
    const data = encodeAnchorTraceCall({
      signalIdHash: `0x${'b'.repeat(64)}`,
      traceHash,
      uri: 'ipfs://example',
    })

    expect(data.startsWith(TRACE_ANCHOR_METHOD_ID)).toBe(true)
    expect(data).toContain('a'.repeat(64))
    expect(data).toContain('b'.repeat(64))
    expect(data).toContain(hexFor('ipfs://example'))
  })

  it('requests an explicit wallet signature for the anchor transaction', async () => {
    const requests: Array<{ method: string; params?: unknown[] }> = []
    const provider = fakeProvider(async (args) => {
      requests.push(args)
      return '0xtx'
    })

    await expect(
      sendAnchorTransaction(provider, {
        contractAddress,
        from: account,
        signalIdHash: `0x${'b'.repeat(64)}`,
        traceHash,
        uri: 'ipfs://example',
      }),
    ).resolves.toBe('0xtx')

    expect(requests[0]).toMatchObject({ method: 'eth_sendTransaction' })
    expect(requests[0].params?.[0]).toMatchObject({
      from: account,
      to: contractAddress,
      value: '0x0',
    })
  })

  it('requests an explicit wallet signature for contract deployment', async () => {
    const requests: Array<{ method: string; params?: unknown[] }> = []
    const provider = fakeProvider(async (args) => {
      requests.push(args)
      return '0xdeploy'
    })

    await expect(sendDeployTransaction(provider, account)).resolves.toBe('0xdeploy')
    expect(requests[0].method).toBe('eth_sendTransaction')
    expect(requests[0].params?.[0]).toMatchObject({
      from: account,
      value: '0x0',
    })
    expect(String((requests[0].params?.[0] as { data: string }).data)).toMatch(/^0x[0-9a-f]+$/)
  })

  it('builds ArcScan transaction URLs', () => {
    expect(txExplorerUrl('0xabc')).toBe('https://testnet.arcscan.app/tx/0xabc')
  })
})

function fakeProvider(handler: (args: { method: string; params?: unknown[] }) => Promise<unknown>): Eip1193Provider {
  return {
    request: async <T>(args: { method: string; params?: unknown[] }) => handler(args) as Promise<T>,
  }
}

function hexFor(value: string): string {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
