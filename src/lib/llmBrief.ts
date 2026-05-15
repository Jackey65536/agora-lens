import type { BriefDraft, MarketSignal } from './agoraAgent'

export type LlmBriefDraft = BriefDraft

export type LlmBriefResult =
  | {
      draft: LlmBriefDraft
      mode: 'llm'
      model: string
    }
  | {
      mode: 'fallback'
      operatorPrompt: string
      reason: string
    }

interface GenerateOptions {
  fetchImpl?: typeof fetch
}

export async function generateLlmBriefDraft(
  signal: MarketSignal,
  options: GenerateOptions = {},
): Promise<LlmBriefResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl('/api/briefs/generate', {
    body: JSON.stringify({ signal }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to generate LLM brief'))
  }

  return (await response.json()) as LlmBriefResult
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string }
    return payload.error ?? fallback
  } catch {
    return fallback
  }
}
