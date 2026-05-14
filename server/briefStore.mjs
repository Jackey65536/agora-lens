import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export const CURRENT_SCHEMA_VERSION = 1

export function defaultDataDir() {
  return process.env.AGORA_LENS_DATA_DIR ?? path.join(process.cwd(), 'data')
}

export function validateBriefArchiveInput(input) {
  if (!input || typeof input !== 'object') {
    throw validationError('archive input must be an object')
  }

  const { brief, signal } = input
  if (!signal || typeof signal !== 'object') throw validationError('signal is required')
  if (!brief || typeof brief !== 'object') throw validationError('brief is required')

  requireString(signal.id, 'signal.id')
  requireString(signal.title, 'signal.title')
  requireString(signal.source, 'signal.source')
  requireString(signal.sourceLabel, 'signal.sourceLabel')
  requireString(signal.receivedAt, 'signal.receivedAt')
  requireString(signal.text, 'signal.text')

  requireString(brief.headline, 'brief.headline')
  requireString(brief.category, 'brief.category')
  requireString(brief.sourceLanguage, 'brief.sourceLanguage')
  requireString(brief.translatedThesis, 'brief.translatedThesis')
  requireString(brief.marketQuestion, 'brief.marketQuestion')
  requireString(brief.confidence, 'brief.confidence')
  requireString(brief.timeframe, 'brief.timeframe')
  if (typeof brief.probability !== 'number') {
    throw validationError('brief.probability must be a number')
  }
  if (brief.probability < 0 || brief.probability > 100) {
    throw validationError('brief.probability must be between 0 and 100')
  }
  requireStringArray(brief.rationale, 'brief.rationale')
  requireStringArray(brief.riskFlags, 'brief.riskFlags')
  requireStringArray(brief.nextActions, 'brief.nextActions')
  requireAgentSteps(brief.agentSteps)
  requireContractSketch(brief.contractSketch)

  if (!brief.evidencePacket || typeof brief.evidencePacket !== 'object') {
    throw validationError('brief.evidencePacket is required')
  }
  requireString(brief.evidencePacket.network, 'brief.evidencePacket.network')
  if (typeof brief.evidencePacket.chainId !== 'number') {
    throw validationError('brief.evidencePacket.chainId must be a number')
  }
  requireString(brief.evidencePacket.settlementAsset, 'brief.evidencePacket.settlementAsset')
  requireString(brief.evidencePacket.traceHash, 'brief.evidencePacket.traceHash')
  if (!isSupportedDigest(brief.evidencePacket.traceHash)) {
    throw validationError('brief.evidencePacket.traceHash must be a supported digest')
  }
  requireString(brief.evidencePacket.storagePlan, 'brief.evidencePacket.storagePlan')
  if (!brief.evidencePacket.payload || typeof brief.evidencePacket.payload !== 'object') {
    throw validationError('brief.evidencePacket.payload is required')
  }
}

export async function createBriefArchive(input, options = {}) {
  validateBriefArchiveInput(input)

  const now = options.now ?? new Date()
  const createdAt = now.toISOString()
  const id = options.id ?? makeArchiveId(now)
  const record = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id,
    createdAt,
    updatedAt: createdAt,
    appVersion: input.appVersion ?? 'unknown',
    signal: input.signal,
    brief: input.brief,
  }

  const filePath = archivePath(id, options)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })

  return record
}

export async function getBriefArchive(id, options = {}) {
  assertArchiveId(id)
  const raw = await readFile(archivePath(id, options), 'utf8')
  return JSON.parse(raw)
}

export async function listBriefArchives(options = {}) {
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100))
  const dir = archivesDir(options)
  let entries = []

  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }

  const records = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map(async (entry) => JSON.parse(await readFile(path.join(dir, entry.name), 'utf8'))),
  )

  return records
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit)
    .map(toSummary)
}

export function toSummary(record) {
  return {
    id: record.id,
    createdAt: record.createdAt,
    headline: record.brief.headline,
    marketQuestion: record.brief.marketQuestion,
    probability: record.brief.probability,
    confidence: record.brief.confidence,
    traceHash: record.brief.evidencePacket.traceHash,
  }
}

function makeArchiveId(now) {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return `brief_${stamp}_${randomUUID().slice(0, 8)}`
}

function archivesDir(options) {
  return path.join(options.dataDir ?? defaultDataDir(), 'briefs')
}

function archivePath(id, options) {
  assertArchiveId(id)
  return path.join(archivesDir(options), `${id}.json`)
}

function assertArchiveId(id) {
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(id)) {
    throw validationError('archive id is invalid')
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError(`${label} is required`)
  }
}

function requireStringArray(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string')) {
    throw validationError(`${label} must be a non-empty string array`)
  }
}

function requireAgentSteps(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw validationError('brief.agentSteps must be a non-empty array')
  }

  for (const step of value) {
    if (!step || typeof step !== 'object') throw validationError('brief.agentSteps entries must be objects')
    requireString(step.label, 'brief.agentSteps.label')
    requireString(step.detail, 'brief.agentSteps.detail')
    if (step.status !== 'complete' && step.status !== 'watch') {
      throw validationError('brief.agentSteps.status must be complete or watch')
    }
  }
}

function requireContractSketch(value) {
  if (!value || typeof value !== 'object') throw validationError('brief.contractSketch is required')
  requireString(value.yes, 'brief.contractSketch.yes')
  requireString(value.no, 'brief.contractSketch.no')
  requireString(value.resolution, 'brief.contractSketch.resolution')
  requireString(value.invalid, 'brief.contractSketch.invalid')
}

function isSupportedDigest(value) {
  return /^0x[a-f0-9]{64}$/i.test(value) || /^0xfallback[a-f0-9]{56}$/i.test(value)
}

function validationError(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}
