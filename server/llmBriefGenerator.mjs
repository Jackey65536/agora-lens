const DEFAULT_MODEL = 'gpt-5.4-mini'
const MAX_SIGNAL_TEXT_CHARS = 12_000
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'

export const BRIEF_DRAFT_SCHEMA = {
  additionalProperties: false,
  properties: {
    confidence: { enum: ['low', 'medium', 'high'], type: 'string' },
    headline: { type: 'string' },
    marketQuestion: { type: 'string' },
    nextActions: {
      items: { type: 'string' },
      maxItems: 4,
      minItems: 2,
      type: 'array',
    },
    probability: { maximum: 100, minimum: 0, type: 'number' },
    rationale: {
      items: { type: 'string' },
      maxItems: 6,
      minItems: 2,
      type: 'array',
    },
    sourceLanguage: { type: 'string' },
    timeframe: { type: 'string' },
    translatedThesis: { type: 'string' },
  },
  required: [
    'headline',
    'sourceLanguage',
    'translatedThesis',
    'marketQuestion',
    'probability',
    'confidence',
    'timeframe',
    'rationale',
    'nextActions',
  ],
  type: 'object',
}

export function validateGenerateInput(input) {
  if (!input || typeof input !== 'object') throw validationError('generate input must be an object')
  const { signal } = input
  if (!signal || typeof signal !== 'object') throw validationError('signal is required')

  requireString(signal.id, 'signal.id')
  requireString(signal.title, 'signal.title')
  requireString(signal.source, 'signal.source')
  requireString(signal.sourceLabel, 'signal.sourceLabel')
  requireString(signal.receivedAt, 'signal.receivedAt')
  requireString(signal.text, 'signal.text')
  if (signal.text.length > MAX_SIGNAL_TEXT_CHARS) throw validationError('signal.text is too long')

  return {
    signal: {
      id: signal.id,
      receivedAt: signal.receivedAt,
      source: signal.source,
      sourceLabel: signal.sourceLabel,
      sources: Array.isArray(signal.sources) ? signal.sources : [],
      text: signal.text,
      title: signal.title,
    },
  }
}

export async function generateBriefDraft(input, options = {}) {
  const { signal } = validateGenerateInput(input)
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? ''
  const model = options.model ?? process.env.AGORA_LENS_LLM_MODEL ?? DEFAULT_MODEL

  if (!apiKey) {
    const reason = 'LLM generator is not configured on this server.'
    return fallbackResult(signal, reason)
  }

  try {
    const request = buildOpenAiRequest(signal, model, options.now ?? new Date())
    const payload = options.callModel
      ? await options.callModel(request)
      : await callOpenAiResponses(request, { apiKey, timeoutMs: options.timeoutMs })
    const draft = validateBriefDraft(parseModelOutput(payload))

    return {
      draft,
      mode: 'llm',
      model,
    }
  } catch (error) {
    return fallbackResult(signal, error instanceof Error ? error.message : 'LLM generation failed')
  }
}

export function validateBriefDraft(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('draft must be an object')
  }

  const draft = {
    confidence: requireEnum(value.confidence, ['low', 'medium', 'high'], 'draft.confidence'),
    headline: requireBoundedString(value.headline, 'draft.headline', 4, 120),
    marketQuestion: requireMarketQuestion(value.marketQuestion),
    nextActions: requireStringArray(value.nextActions, 'draft.nextActions', 2, 4),
    probability: requireProbability(value.probability),
    rationale: requireStringArray(value.rationale, 'draft.rationale', 2, 6),
    sourceLanguage: requireBoundedString(value.sourceLanguage, 'draft.sourceLanguage', 2, 80),
    timeframe: requireBoundedString(value.timeframe, 'draft.timeframe', 2, 60),
    translatedThesis: requireBoundedString(value.translatedThesis, 'draft.translatedThesis', 20, 600),
  }

  return draft
}

export function buildOperatorPrompt(signal, reason) {
  const sourceList =
    signal.sources && signal.sources.length > 0
      ? signal.sources
          .slice(0, 4)
          .map((source) => `- ${source.title}${source.url ? ` (${source.url})` : ''}`)
          .join('\n')
      : `- ${signal.sourceLabel}`

  return [
    `Manual review prompt: ${reason}`,
    '',
    `Signal: ${signal.title}`,
    `Source type: ${signal.source}`,
    `Received at: ${signal.receivedAt}`,
    '',
    'Sources:',
    sourceList,
    '',
    'Please review the source text, add missing objective settlement criteria, verify at least one independent source, then run the deterministic fallback brief before publishing or anchoring.',
  ].join('\n')
}

export function buildOpenAiRequest(signal, model, now) {
  return {
    input: buildPrompt(signal, now),
    model,
    text: {
      format: {
        description:
          'A draft market brief generated from source material. The app will add settlement rules, risk gates, and evidence hashing separately.',
        name: 'agora_market_brief_draft',
        schema: BRIEF_DRAFT_SCHEMA,
        strict: true,
        type: 'json_schema',
      },
    },
  }
}

async function callOpenAiResponses(request, options) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs ?? 20_000))

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      body: JSON.stringify(request),
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw validationError(`LLM request failed with status ${response.status}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

function parseModelOutput(payload) {
  if (payload && typeof payload.output_text === 'string') {
    return parseJson(payload.output_text)
  }

  const output = Array.isArray(payload?.output) ? payload.output : []
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : []
    for (const part of content) {
      if (typeof part?.text === 'string') return parseJson(part.text)
      if (part?.json && typeof part.json === 'object') return part.json
    }
  }

  throw validationError('LLM response did not include structured output')
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    throw validationError('LLM response was not valid JSON')
  }
}

function fallbackResult(signal, reason) {
  return {
    mode: 'fallback',
    operatorPrompt: buildOperatorPrompt(signal, reason),
    reason,
  }
}

function buildPrompt(signal, now) {
  const sources =
    signal.sources && signal.sources.length > 0
      ? signal.sources
          .slice(0, 6)
          .map((source, index) => {
            const published = source.publishedAt ? ` published=${source.publishedAt}` : ''
            const url = source.url ? ` url=${source.url}` : ''
            return `${index + 1}. ${source.title}${url}${published}`
          })
          .join('\n')
      : `1. ${signal.sourceLabel}`

  return [
    'You are drafting a prediction-market brief for Agora Lens.',
    'Use only the supplied source material. Do not invent URLs, events, dates, or named sources.',
    'Return a concise JSON object matching the schema. The app will add settlement rules, risk gates, and trace hashing.',
    'The marketQuestion must be objective, time-bounded, and end with a question mark.',
    '',
    `Generated at: ${now.toISOString()}`,
    `Signal title: ${signal.title}`,
    `Signal source: ${signal.source} / ${signal.sourceLabel}`,
    '',
    'Sources:',
    sources,
    '',
    'Source material:',
    signal.text,
  ].join('\n')
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError(`${label} is required`)
  }
}

function requireBoundedString(value, label, min, max) {
  if (typeof value !== 'string') throw validationError(`${label} must be a string`)
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length < min || trimmed.length > max) {
    throw validationError(`${label} must be ${min} to ${max} characters`)
  }
  return trimmed
}

function requireStringArray(value, label, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw validationError(`${label} must contain ${min} to ${max} strings`)
  }

  return value.map((entry, index) => requireBoundedString(entry, `${label}[${index}]`, 8, 240))
}

function requireEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw validationError(`${label} must be ${allowed.slice(0, -1).join(', ')}, or ${allowed.at(-1)}`)
  }
  return value
}

function requireProbability(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw validationError('draft.probability must be a number')
  }
  if (value < 0 || value > 100) throw validationError('draft.probability must be between 0 and 100')
  return Math.round(value)
}

function requireMarketQuestion(value) {
  const question = requireBoundedString(value, 'draft.marketQuestion', 20, 220)
  if (!question.endsWith('?')) throw validationError('draft.marketQuestion must end with a question mark')
  return question
}

function validationError(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}
