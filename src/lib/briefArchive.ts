import type { MarketBrief, MarketSignal } from './agoraAgent'

export interface BriefArchiveRecord {
  schemaVersion: number
  id: string
  createdAt: string
  updatedAt: string
  appVersion: string
  signal: MarketSignal
  brief: MarketBrief
}

export interface SaveBriefArchiveInput {
  appVersion: string
  signal: MarketSignal
  brief: MarketBrief
}

export async function saveBriefArchive(input: SaveBriefArchiveInput): Promise<BriefArchiveRecord> {
  const response = await fetch('/api/briefs', {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to save brief'))
  }

  const payload = (await response.json()) as { record: BriefArchiveRecord }
  return payload.record
}

export async function loadBriefArchive(id: string): Promise<BriefArchiveRecord> {
  const response = await fetch(`/api/briefs/${encodeURIComponent(id)}`)

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to load brief'))
  }

  const payload = (await response.json()) as { record: BriefArchiveRecord }
  return payload.record
}

export function briefIdFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get('brief')
  return value && /^[a-zA-Z0-9_-]{3,80}$/.test(value) ? value : null
}

export function shareUrlForBrief(id: string, href: string): string {
  const url = new URL(href)
  url.searchParams.set('brief', id)
  return url.toString()
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string }
    return payload.error ?? fallback
  } catch {
    return fallback
  }
}
