import { sha256Hex } from './sha256'

export type SignalSource = 'news' | 'social' | 'research' | 'manual'
export type SourceReferenceType = 'news' | 'url' | 'rss' | 'research' | 'social' | 'manual'

export interface SourceReference {
  capturedAt: string
  excerpt?: string
  publishedAt?: string
  sourceType: SourceReferenceType
  title: string
  url?: string
}

export interface RationaleSource {
  capturedAt: string
  publishedAt?: string
  rationale: string
  sourceTitle: string
  sourceUrl?: string
}

export interface MarketSignal {
  id: string
  sources?: SourceReference[]
  title: string
  source: SignalSource
  sourceLabel: string
  receivedAt: string
  text: string
}

export interface ContractSketch {
  yes: string
  no: string
  resolution: string
  invalid: string
}

export interface AgentStep {
  label: string
  detail: string
  status: 'complete' | 'watch'
}

export interface EvidencePacket {
  network: 'Arc Testnet'
  chainId: 5042002
  settlementAsset: 'USDC'
  traceHash: string
  storagePlan: string
  payload: {
    agent: string
    signalId: string
    generatedAt: string
    marketQuestion: string
    probability: number
    confidence: string
    rationale: string[]
    sourceReferences: SourceReference[]
    resolution: string
  }
}

export interface MarketBrief {
  id: string
  headline: string
  category: string
  sourceLanguage: string
  translatedThesis: string
  marketQuestion: string
  probability: number
  confidence: 'low' | 'medium' | 'high'
  timeframe: string
  contractSketch: ContractSketch
  rationale: string[]
  rationaleSources: RationaleSource[]
  riskFlags: string[]
  nextActions: string[]
  agentSteps: AgentStep[]
  evidencePacket: EvidencePacket
  sourceReferences: SourceReference[]
}

export const sampleSignals: MarketSignal[] = [
  {
    id: 'mandarin-macro',
    title: 'Mandarin macro signal',
    source: 'news',
    sourceLabel: 'Chinese market desk note',
    receivedAt: '2026-05-14T08:40:00.000Z',
    text:
      '中文消息：多家券商早报称，离岸人民币波动率上升，交易员正在关注下周央行公开市场操作和地产融资政策窗口。若政策措辞偏宽松，港股地产与高收益美元债可能出现短线重定价。',
  },
  {
    id: 'whale-migration',
    title: 'Hyperliquid whale migration',
    source: 'research',
    sourceLabel: 'Public leaderboard monitor',
    receivedAt: '2026-05-14T08:55:00.000Z',
    text:
      'Several top Hyperliquid leaderboard wallets reduced perp exposure and started posting similar positions on a fork venue. The migration is early, but the same addresses led profitable rotations during prior incentive campaigns.',
  },
  {
    id: 'translation-alpha',
    title: 'Non-English event discovery',
    source: 'social',
    sourceLabel: 'Spanish policy thread',
    receivedAt: '2026-05-14T09:05:00.000Z',
    text:
      'Un hilo en espanol resume que el regulador energetico prepara una decision sobre pagos a generadoras solares. La noticia todavia no aparece en los mercados de prediccion en ingles.',
  },
]

export async function analyzeSignal(signal: MarketSignal): Promise<MarketBrief> {
  const normalized = normalize(signal.text)
  const sourceLanguage = detectLanguage(normalized)
  const category = categorize(normalized)
  const timeframe = pickTimeframe(normalized)
  const translatedThesis = createThesis(normalized, sourceLanguage, category)
  const probability = estimateProbability(normalized, signal.source)
  const confidence = estimateConfidence(normalized, signal.source, probability)
  const marketQuestion = buildQuestion(translatedThesis, category, timeframe)
  const contractSketch = buildContractSketch(translatedThesis, timeframe)
  const rationale = buildRationale(normalized, category, probability)
  const sourceReferences = normalizeSourceReferences(signal)
  const rationaleSources = buildRationaleSources(rationale, sourceReferences)
  const riskFlags = buildRiskFlags(normalized, sourceLanguage)
  const nextActions = buildNextActions(category)
  const agentSteps = buildAgentSteps(sourceLanguage, category, probability)
  const payload = {
    agent: 'Agora Lens local agent v0.1',
    signalId: signal.id,
    generatedAt: new Date().toISOString(),
    marketQuestion,
    probability,
    confidence,
    rationale,
    sourceReferences,
    resolution: contractSketch.resolution,
  }
  const traceHash = await hashEvidence(payload)

  return {
    id: signal.id,
    headline: signal.title,
    category,
    sourceLanguage,
    translatedThesis,
    marketQuestion,
    probability,
    confidence,
    timeframe,
    contractSketch,
    rationale,
    rationaleSources,
    riskFlags,
    nextActions,
    agentSteps,
    sourceReferences,
    evidencePacket: {
      network: 'Arc Testnet',
      chainId: 5042002,
      settlementAsset: 'USDC',
      traceHash,
      storagePlan:
        'Pin full trace JSON offchain, then write this SHA-256 digest to an Arc contract event or memo field.',
      payload,
    },
  }
}

function normalizeSourceReferences(signal: MarketSignal): SourceReference[] {
  const references =
    signal.sources && signal.sources.length > 0
      ? signal.sources
      : [
          {
            capturedAt: signal.receivedAt,
            excerpt: compactSubject(signal.text, 180),
            sourceType: signal.source,
            title: signal.sourceLabel,
          },
        ]

  const seen = new Set<string>()
  const normalized: SourceReference[] = []

  for (const reference of references) {
    const url = reference.url ? normalizeSourceUrl(reference.url) : undefined
    const key = url ?? `${reference.title}|${reference.publishedAt ?? reference.capturedAt}`
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push({
      capturedAt: reference.capturedAt,
      excerpt: reference.excerpt,
      publishedAt: reference.publishedAt,
      sourceType: reference.sourceType,
      title: reference.title,
      url,
    })
  }

  return normalized
}

function normalizeSourceUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key)
    }
    url.hostname = url.hostname.toLowerCase()
    return url.toString().replace(/\/$/, '')
  } catch {
    return value
  }
}

function buildRationaleSources(rationale: string[], references: SourceReference[]): RationaleSource[] {
  const fallback = references[0]
  if (!fallback) return []

  return rationale.map((item, index) => {
    const source = references[index] ?? fallback
    return {
      capturedAt: source.capturedAt,
      publishedAt: source.publishedAt,
      rationale: item,
      sourceTitle: source.title,
      sourceUrl: source.url,
    }
  })
}

export function normalize(input: string): string {
  return input
    .replace(/\s+/g, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .trim()
}

export function detectLanguage(text: string): string {
  if (/[\u4e00-\u9fff]/.test(text)) return 'Mandarin Chinese'
  if (/\b(el|la|los|las|un|una|que|todavia|mercados|regulador)\b/i.test(text)) {
    return 'Spanish'
  }
  return 'English'
}

export function categorize(text: string): string {
  const lower = text.toLowerCase()
  if (/hyperliquid|whale|leaderboard|copy-trad|perp/.test(lower)) return 'social trading intelligence'
  if (/polymarket|prediction|market|mercados de prediccion/.test(lower)) return 'prediction market vertical'
  if (/央行|人民币|rates|inflation|macro|policy|regulator|regulador/.test(lower)) return 'macro policy'
  if (/token|airdrop|mainnet|fork|chain|wallet/.test(lower)) return 'crypto market structure'
  return 'market intelligence'
}

export function estimateProbability(text: string, source: SignalSource): number {
  const lower = text.toLowerCase()
  let score = source === 'research' ? 57 : 52

  if (/\d|%|\$|usdc|美元|人民币/.test(text)) score += 5
  if (/confirmed|announced|official|regulator|央行|公开市场|leaderboard/.test(lower)) score += 8
  if (/early|may|might|rumor|unconfirmed|可能|关注|todavia/.test(lower)) score -= 7
  if (/multiple|several|多家|same addresses|prior/.test(lower)) score += 6
  if (/not|denied|rejected|无法|no aparece/.test(lower)) score -= 4

  return Math.max(18, Math.min(82, score))
}

export function estimateConfidence(
  text: string,
  source: SignalSource,
  probability: number,
): 'low' | 'medium' | 'high' {
  const hasEvidence = /\d|multiple|several|多家|official|regulator|leaderboard/i.test(text)
  if (source === 'research' && hasEvidence && probability >= 58) return 'high'
  if (hasEvidence || probability >= 57) return 'medium'
  return 'low'
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

async function hashEvidence(payload: EvidencePacket['payload']): Promise<string> {
  const serialized = stableStringify(payload)
  const data = new TextEncoder().encode(serialized)

  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
    return `0x${Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')}`
  }

  return `0x${sha256Hex(serialized)}`
}

function createThesis(text: string, language: string, category: string): string {
  if (language === 'Mandarin Chinese') {
    if (/人民币|央行|港股|地产|美元债/.test(text)) {
      return 'Chinese macro policy desks are watching whether easing language drives a short-term repricing in CNH, Hong Kong property equities, and high-yield USD credit.'
    }

    return `Chinese source signal converted into an English ${category} thesis.`
  }

  if (language === 'Spanish') {
    if (/regulador|energetico|solares|prediccion/i.test(text)) {
      return 'Spanish energy policy watchers expect a solar-generator payment decision that has not yet reached English prediction markets.'
    }

    return `Spanish source signal converted into an English ${category} thesis.`
  }

  const compact = text.length > 180 ? `${text.slice(0, 177)}...` : text
  if (language === 'English') return `${category}: ${compact}`
  return `${language} signal translated into an English market thesis: ${compact}`
}

function pickTimeframe(text: string): string {
  if (/下周|next week|weekly/i.test(text)) return '7 days'
  if (/month|月底|30 days/i.test(text)) return '30 days'
  return '14 days'
}

function buildQuestion(thesis: string, category: string, timeframe: string): string {
  const subject = compactSubject(thesis.replace(/^.*?: /, ''), 118)
  const threshold = category === 'macro policy' ? 58 : 60
  return `Will English-language prediction markets price "${subject}" above ${threshold}% YES within ${timeframe}?`
}

function buildContractSketch(thesis: string, timeframe: string): ContractSketch {
  const subject = compactSubject(thesis.replace(/^.*?: /, ''), 132)
  return {
    yes: `YES resolves if a qualifying public market or oracle-backed feed prices the thesis above the threshold before ${timeframe}.`,
    no: `NO resolves if the threshold is not reached before the deadline.`,
    resolution: `Use timestamped market data, archived source links, and the full agent trace for "${subject}".`,
    invalid:
      'Invalidate if the event cannot be mapped to a specific market, source, or objective price feed.',
  }
}

function compactSubject(input: string, maxLength: number): string {
  const clean = input.replace(/\s+/g, ' ').replace(/[.?!,;:]$/, '').trim()
  if (clean.length <= maxLength) return clean

  const candidate = clean.slice(0, maxLength)
  const lastSpace = candidate.lastIndexOf(' ')
  const cutPoint = lastSpace > 80 ? lastSpace : maxLength
  return `${candidate.slice(0, cutPoint).replace(/[.?!,;:]$/, '')}...`
}

function buildRationale(text: string, category: string, probability: number): string[] {
  const lower = text.toLowerCase()
  const points = [
    `Classified as ${category}, which maps to the Agora RFB surface for market-facing agents.`,
    `Initial probability is ${probability}% based on source type, specificity, and urgency markers.`,
  ]

  if (/多家|multiple|several|same addresses/i.test(text)) {
    points.push('The signal has cross-source reinforcement instead of a single isolated mention.')
  }

  if (/early|可能|may|todavia|unconfirmed/i.test(lower)) {
    points.push('The signal is early, so the agent keeps confidence capped until a stronger public source appears.')
  }

  return points
}

function buildRiskFlags(text: string, language: string): string[] {
  const flags = []
  if (language !== 'English') flags.push('Translation drift can change the contract meaning.')
  if (/rumor|unconfirmed|可能|todavia|early/i.test(text)) flags.push('Source confidence is not final.')
  if (!/\d|%|\$|人民币|usdc/i.test(text)) flags.push('No numeric trigger was present in the raw signal.')
  if (flags.length === 0) flags.push('No blocking risk detected in the first-pass trace.')
  return flags
}

function buildNextActions(category: string): string[] {
  const actions = [
    'Find two independent public sources before surfacing this to users.',
    'Attach source URLs and freeze the evidence packet hash before any onchain action.',
  ]

  if (category.includes('prediction')) {
    actions.push('Check whether an English prediction market already exists before proposing a new one.')
  } else {
    actions.push('Map the thesis to a liquid venue, index, or oracle-backed data feed.')
  }

  return actions
}

function buildAgentSteps(language: string, category: string, probability: number): AgentStep[] {
  return [
    {
      label: 'Ingest',
      detail: `Normalized raw ${language} signal and removed noisy whitespace/links.`,
      status: 'complete',
    },
    {
      label: 'Classify',
      detail: `Mapped signal to ${category}.`,
      status: 'complete',
    },
    {
      label: 'Price',
      detail: `Produced a ${probability}% first-pass probability with confidence gating.`,
      status: 'complete',
    },
    {
      label: 'Settle',
      detail: 'Prepared a hashable trace packet for Arc-native evidence anchoring.',
      status: 'watch',
    },
  ]
}
