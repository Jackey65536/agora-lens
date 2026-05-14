import { createHash } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import net from 'node:net'

const DEFAULT_MAX_REMOTE_BYTES = 512 * 1024
const MAX_SIGNAL_TEXT_CHARS = 12_000
const MAX_NOTE_CHARS = 20_000
const MAX_REDIRECTS = 3
const SAFE_REMOTE_PROTOCOLS = new Set(['http:', 'https:'])
const TEXT_CONTENT_TYPES = [
  'application/atom+xml',
  'application/rss+xml',
  'application/xml',
  'text/html',
  'text/plain',
  'text/xml',
]

export function validateImportInput(input) {
  if (!input || typeof input !== 'object') throw validationError('source import input must be an object')
  if (!['url', 'rss', 'research', 'social'].includes(input.type)) {
    throw validationError('source import type is invalid')
  }

  const normalized = {
    sourceTitle: cleanText(input.sourceTitle ?? ''),
    sourceUrl: input.sourceUrl ? normalizeSourceUrl(input.sourceUrl) : '',
    text: cleanText(input.text ?? ''),
    type: input.type,
    url: input.url ? normalizeSourceUrl(input.url) : '',
  }

  if ((normalized.type === 'url' || normalized.type === 'rss') && !normalized.url) {
    throw validationError('URL is required')
  }

  if ((normalized.type === 'research' || normalized.type === 'social') && !normalized.text) {
    throw validationError('source text is required')
  }

  if (normalized.text.length > MAX_NOTE_CHARS) throw validationError('source text is too long')

  return normalized
}

export async function importSource(input, options = {}) {
  const normalized = validateImportInput(input)
  const now = options.now ?? new Date()
  const capturedAt = now.toISOString()

  if (normalized.type === 'url' || normalized.type === 'rss') {
    await assertSafeRemoteUrl(normalized.url, options)
    const remote = options.fetchText
      ? await options.fetchText(normalized.url, { sourceType: normalized.type })
      : await fetchRemoteText(normalized.url, options)

    const finalUrl = normalizeSourceUrl(remote.finalUrl ?? normalized.url)
    await assertSafeRemoteUrl(finalUrl, options)

    if (normalized.type === 'rss' || looksLikeFeed(remote.contentType, remote.text)) {
      return signalFromFeed(remote.text, finalUrl, capturedAt)
    }

    return signalFromWebpage(remote.text, finalUrl, capturedAt)
  }

  return signalFromNote(normalized, capturedAt)
}

export function normalizeSourceUrl(value) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw validationError('URL is invalid')
  }

  if (!SAFE_REMOTE_PROTOCOLS.has(parsed.protocol)) throw validationError('URL must use http or https')
  if (parsed.username || parsed.password) throw validationError('URL credentials are not allowed')

  parsed.hash = ''
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) parsed.searchParams.delete(key)
  }
  parsed.hostname = parsed.hostname.toLowerCase()

  return parsed.toString().replace(/\/$/, '')
}

export function dedupeSourceReferences(references) {
  const seen = new Set()
  const deduped = []

  for (const reference of references) {
    const urlKey = reference.url ? normalizeSourceUrl(reference.url) : ''
    const key = urlKey || `${reference.title}|${reference.publishedAt ?? reference.capturedAt}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push({ ...reference, url: urlKey || undefined })
  }

  return deduped
}

async function signalFromFeed(xml, feedUrl, capturedAt) {
  const channelTitle = extractXmlTag(extractXmlBlocks(xml, 'channel')[0] ?? xml, 'title')
  const rawItems = extractXmlBlocks(xml, 'item')
  const rawEntries = rawItems.length > 0 ? rawItems : extractXmlBlocks(xml, 'entry')

  const items = rawEntries
    .map((entry) => {
      const title = cleanText(extractXmlTag(entry, 'title') || 'Untitled feed item')
      const link = normalizeOptionalUrl(extractXmlTag(entry, 'link') || extractAtomLink(entry) || feedUrl)
      const publishedAt = parseDate(extractXmlTag(entry, 'pubDate') || extractXmlTag(entry, 'published') || extractXmlTag(entry, 'updated'))
      const summary = cleanText(
        stripHtml(
          extractXmlTag(entry, 'description') ||
            extractXmlTag(entry, 'summary') ||
            extractXmlTag(entry, 'content:encoded') ||
            '',
        ),
      )
      return { link, publishedAt, summary, title }
    })
    .filter((item) => item.title || item.summary)

  if (items.length === 0) throw validationError('RSS feed does not contain readable items')

  const sources = dedupeSourceReferences(
    items.slice(0, 6).map((item) => ({
      capturedAt,
      excerpt: compact(item.summary || item.title, 220),
      publishedAt: item.publishedAt,
      sourceType: 'rss',
      title: item.title,
      url: item.link,
    })),
  )

  const text = items
    .slice(0, 4)
    .map((item) => `${item.title}. ${item.summary}`.trim())
    .join('\n\n')

  return {
    signal: buildSignal({
      capturedAt,
      source: 'news',
      sourceLabel: cleanText(channelTitle) || hostLabel(feedUrl),
      sources,
      text,
      title: cleanText(channelTitle) || sources[0]?.title || 'Imported RSS feed',
      type: 'rss',
    }),
    sourceCount: sources.length,
  }
}

function signalFromWebpage(html, url, capturedAt) {
  const title = extractHtmlTitle(html) || hostLabel(url)
  const text = readableTextFromHtml(html)
  if (!text) throw validationError('URL did not contain readable text')

  const sources = dedupeSourceReferences([
    {
      capturedAt,
      excerpt: compact(text, 220),
      sourceType: 'url',
      title,
      url,
    },
  ])

  return {
    signal: buildSignal({
      capturedAt,
      source: 'news',
      sourceLabel: hostLabel(url),
      sources,
      text,
      title,
      type: 'url',
    }),
    sourceCount: sources.length,
  }
}

function signalFromNote(input, capturedAt) {
  const sourceType = input.type
  const title = input.sourceTitle || firstSentence(input.text) || (sourceType === 'social' ? 'Imported social signal' : 'Imported research note')
  const url = input.sourceUrl || sourceUrlFromText(input.text)
  const sources = dedupeSourceReferences([
    {
      capturedAt,
      excerpt: compact(input.text, 220),
      sourceType,
      title,
      url: url || undefined,
    },
    ...(url ? [{ capturedAt, excerpt: compact(input.text, 120), sourceType, title, url }] : []),
  ])

  return {
    signal: buildSignal({
      capturedAt,
      source: sourceType === 'social' ? 'social' : 'research',
      sourceLabel: title,
      sources,
      text: input.text,
      title,
      type: sourceType,
    }),
    sourceCount: sources.length,
  }
}

function buildSignal({ capturedAt, source, sourceLabel, sources, text, title, type }) {
  const cleanTitle = compact(title, 72) || 'Imported signal'
  const cleanSourceLabel = compact(sourceLabel, 72) || 'Imported source'
  const cleanSignalText = compact(cleanText(text), MAX_SIGNAL_TEXT_CHARS)
  if (!cleanSignalText) throw validationError('source did not contain readable signal text')

  return {
    id: `import_${type}_${hashId(`${cleanTitle}|${cleanSignalText}`)}`,
    receivedAt: capturedAt,
    source,
    sourceLabel: cleanSourceLabel,
    sources,
    text: cleanSignalText,
    title: cleanTitle,
  }
}

async function fetchRemoteText(url, options) {
  const maxBytes = Number(options.maxBytes ?? process.env.AGORA_LENS_IMPORT_MAX_BYTES ?? DEFAULT_MAX_REMOTE_BYTES)
  let currentUrl = url

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertSafeRemoteUrl(currentUrl, options)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs ?? 8_000))
    let response

    try {
      response = await fetch(currentUrl, {
        headers: {
          Accept: 'text/html,application/rss+xml,application/atom+xml,application/xml,text/plain;q=0.9,*/*;q=0.2',
          'User-Agent': 'AgoraLensSourceImporter/0.3',
        },
        redirect: 'manual',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      currentUrl = normalizeSourceUrl(new URL(response.headers.get('location'), currentUrl).toString())
      continue
    }

    if (!response.ok) throw validationError(`source fetch failed with ${response.status}`)

    const contentType = response.headers.get('content-type') ?? ''
    if (!TEXT_CONTENT_TYPES.some((entry) => contentType.toLowerCase().includes(entry))) {
      throw validationError('source content type is not supported')
    }

    return {
      contentType,
      finalUrl: normalizeSourceUrl(response.url || currentUrl),
      text: await readTextLimited(response, maxBytes),
    }
  }

  throw validationError('source redirected too many times')
}

async function assertSafeRemoteUrl(url, options = {}) {
  const parsed = new URL(normalizeSourceUrl(url))
  const host = parsed.hostname.toLowerCase()

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw validationError('URL host is not allowed')
  }

  const directIpType = net.isIP(host)
  const addresses =
    directIpType === 0
      ? await (options.lookupHostname ? options.lookupHostname(host) : lookup(host, { all: true }).then((records) => records.map((record) => record.address)))
      : [host]

  if (addresses.length === 0 || addresses.some(isBlockedAddress)) {
    throw validationError('URL host is not allowed')
  }
}

function isBlockedAddress(address) {
  const normalized = address.toLowerCase()
  const ipType = net.isIP(normalized)
  if (ipType === 4) {
    const [a, b] = normalized.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    )
  }

  if (ipType === 6) {
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    )
  }

  return true
}

async function readTextLimited(response, maxBytes) {
  if (!response.body?.getReader) {
    const body = Buffer.from(await response.arrayBuffer())
    if (body.length > maxBytes) throw validationError('source response is too large')
    return body.toString('utf8')
  }

  const reader = response.body.getReader()
  const chunks = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) throw validationError('source response is too large')
    chunks.push(value)
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8')
}

function readableTextFromHtml(html) {
  return compact(
    cleanText(
      stripHtml(
        html
          .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
          .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
          .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
          .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' '),
      ),
    ),
    MAX_SIGNAL_TEXT_CHARS,
  )
}

function stripHtml(value) {
  return decodeEntities(
    String(value)
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, ' '),
  )
}

function extractHtmlTitle(html) {
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1]
  const title = ogTitle || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  return title ? cleanText(stripHtml(title)) : ''
}

function extractXmlBlocks(xml, tagName) {
  return [...xml.matchAll(new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, 'gi'))].map(
    (match) => match[1],
  )
}

function extractXmlTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, 'i'))
  return match ? cleanText(stripHtml(match[1])) : ''
}

function extractAtomLink(entry) {
  return entry.match(/<link\b[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ?? ''
}

function looksLikeFeed(contentType, text) {
  const lowerType = String(contentType).toLowerCase()
  return (
    lowerType.includes('rss') ||
    lowerType.includes('atom') ||
    /<(rss|feed)\b/i.test(text.slice(0, 500))
  )
}

function normalizeOptionalUrl(value) {
  try {
    return value ? normalizeSourceUrl(value) : ''
  } catch {
    return ''
  }
}

function sourceUrlFromText(text) {
  return normalizeOptionalUrl(text.match(/https?:\/\/[^\s)]+/i)?.[0] ?? '')
}

function firstSentence(text) {
  return cleanText(text).split(/[.!?\n。！？]/)[0] ?? ''
}

function hostLabel(url) {
  return new URL(url).hostname.replace(/^www\./, '')
}

function parseDate(value) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function hashId(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

function cleanText(value) {
  return decodeEntities(String(value)).replace(/\s+/g, ' ').trim()
}

function compact(value, maxLength) {
  const cleaned = cleanText(value)
  if (cleaned.length <= maxLength) return cleaned
  const candidate = cleaned.slice(0, maxLength)
  const lastSpace = candidate.lastIndexOf(' ')
  const cutPoint = lastSpace > maxLength * 0.55 ? lastSpace : maxLength
  return `${candidate.slice(0, cutPoint).replace(/[.,;:!?，。；：！？-]$/, '')}...`
}

function decodeEntities(value) {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function validationError(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}
