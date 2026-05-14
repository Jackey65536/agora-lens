import { traceAnchorBytecode } from '../contracts/traceAnchor'
import type { MarketBrief, MarketSignal } from './agoraAgent'
import type { Eip1193Provider } from './wallet'
import { sha256Hex } from './sha256'

export const TRACE_ANCHOR_ADDRESS_STORAGE_KEY = 'agora-lens.traceAnchorAddress'
export const TRACE_ANCHOR_EXPLORER_TX_BASE = 'https://testnet.arcscan.app/tx'
export const TRACE_ANCHOR_METHOD_ID = '0xb2bad5bb'

export interface AnchorDraft {
  contractAddress: string
  from: string
  signalIdHash: `0x${string}`
  traceHash: `0x${string}`
  uri: string
}

export interface AnchorReceipt {
  blockHash?: string
  contractAddress?: string | null
  status?: string
  transactionHash: string
}

export function configuredTraceAnchorAddress(): string {
  const envAddress = import.meta.env.VITE_TRACE_ANCHOR_ADDRESS
  if (typeof window === 'undefined') return isAddress(envAddress) ? envAddress : ''

  const saved = window.localStorage.getItem(TRACE_ANCHOR_ADDRESS_STORAGE_KEY)
  if (isAddress(saved)) return saved
  return isAddress(envAddress) ? envAddress : ''
}

export function saveTraceAnchorAddress(address: string) {
  if (typeof window === 'undefined') return
  if (address.trim().length === 0) {
    window.localStorage.removeItem(TRACE_ANCHOR_ADDRESS_STORAGE_KEY)
    return
  }
  if (!isAddress(address)) throw new Error('TraceAnchor address is invalid')
  window.localStorage.setItem(TRACE_ANCHOR_ADDRESS_STORAGE_KEY, address)
}

export function createAnchorDraft(input: {
  account: string
  brief: MarketBrief
  contractAddress: string
  signal: MarketSignal
  uri: string
}): AnchorDraft {
  if (!isAddress(input.account)) throw new Error('Wallet account is invalid')
  if (!isAddress(input.contractAddress)) throw new Error('TraceAnchor address is invalid')
  if (!isBytes32(input.brief.evidencePacket.traceHash)) throw new Error('Trace hash must be bytes32')
  if (input.uri.trim().length === 0) throw new Error('Anchor URI is required')
  if (new TextEncoder().encode(input.uri).length > 2048) throw new Error('Anchor URI exceeds contract limit')

  return {
    contractAddress: input.contractAddress,
    from: input.account,
    signalIdHash: `0x${sha256Hex(input.signal.id)}`,
    traceHash: input.brief.evidencePacket.traceHash as `0x${string}`,
    uri: input.uri,
  }
}

export function encodeAnchorTraceCall(draft: Pick<AnchorDraft, 'signalIdHash' | 'traceHash' | 'uri'>): `0x${string}` {
  if (!isBytes32(draft.traceHash)) throw new Error('Trace hash must be bytes32')
  if (!isBytes32(draft.signalIdHash)) throw new Error('Signal ID hash must be bytes32')

  const uriHex = utf8ToHex(draft.uri)
  const uriByteLength = uriHex.length / 2
  const tail = `${encodeUint256(uriByteLength)}${padHexToWord(uriHex)}`
  const head = `${strip0x(draft.traceHash)}${strip0x(draft.signalIdHash)}${encodeUint256(96)}`

  return `${TRACE_ANCHOR_METHOD_ID}${head}${tail}` as `0x${string}`
}

export async function sendAnchorTransaction(provider: Eip1193Provider, draft: AnchorDraft): Promise<string> {
  return provider.request<string>({
    method: 'eth_sendTransaction',
    params: [
      {
        data: encodeAnchorTraceCall(draft),
        from: draft.from,
        to: draft.contractAddress,
        value: '0x0',
      },
    ],
  })
}

export async function sendDeployTransaction(provider: Eip1193Provider, from: string): Promise<string> {
  if (!isAddress(from)) throw new Error('Wallet account is invalid')
  return provider.request<string>({
    method: 'eth_sendTransaction',
    params: [
      {
        data: traceAnchorBytecode,
        from,
        value: '0x0',
      },
    ],
  })
}

export async function waitForReceipt(
  provider: Eip1193Provider,
  transactionHash: string,
  options: { attempts?: number; intervalMs?: number } = {},
): Promise<AnchorReceipt | null> {
  const attempts = options.attempts ?? 30
  const intervalMs = options.intervalMs ?? 2_000

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const receipt = await provider.request<AnchorReceipt | null>({
      method: 'eth_getTransactionReceipt',
      params: [transactionHash],
    })
    if (receipt) return receipt
    await delay(intervalMs)
  }

  return null
}

export function txExplorerUrl(hash: string): string {
  return `${TRACE_ANCHOR_EXPLORER_TX_BASE}/${hash}`
}

export function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function isBytes32(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value)
}

function encodeUint256(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('uint256 value is invalid')
  return value.toString(16).padStart(64, '0')
}

function utf8ToHex(value: string): string {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function padHexToWord(hex: string): string {
  return hex.padEnd(Math.ceil(hex.length / 64) * 64, '0')
}

function strip0x(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
