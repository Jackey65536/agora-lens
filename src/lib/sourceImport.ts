import type { MarketSignal } from './agoraAgent'

export type SourceImportType = 'url' | 'rss' | 'research' | 'social'

export interface SourceImportInput {
  sourceTitle?: string
  sourceUrl?: string
  text?: string
  type: SourceImportType
  url?: string
}

export async function importSourceMaterial(input: SourceImportInput): Promise<MarketSignal> {
  const response = await fetch('/api/sources/import', {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to import source'))
  }

  const payload = (await response.json()) as { signal: MarketSignal }
  return payload.signal
}

export function sourceUrlFromText(text: string): string {
  return text.match(/https?:\/\/[^\s)]+/i)?.[0] ?? ''
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string }
    return payload.error ?? fallback
  } catch {
    return fallback
  }
}
