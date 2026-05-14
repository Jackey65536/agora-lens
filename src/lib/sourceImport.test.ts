import { afterEach, describe, expect, it, vi } from 'vitest'

import { importSourceMaterial, sourceUrlFromText } from './sourceImport'

describe('source import client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts source import requests to the API', async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({
        signal: {
          id: 'import_url_abc',
          receivedAt: '2026-05-15T01:00:00.000Z',
          source: 'news',
          sourceLabel: 'example.com',
          text: 'Imported signal',
          title: 'Imported title',
        },
      }),
      ok: true,
    }))
    vi.stubGlobal('fetch', fetchMock)

    const signal = await importSourceMaterial({ type: 'url', url: 'https://example.com/story' })

    expect(fetchMock).toHaveBeenCalledWith('/api/sources/import', {
      body: JSON.stringify({ type: 'url', url: 'https://example.com/story' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
    expect(signal.title).toBe('Imported title')
  })

  it('surfaces API validation errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => ({ error: 'URL host is not allowed' }),
        ok: false,
      })),
    )

    await expect(importSourceMaterial({ type: 'url', url: 'http://127.0.0.1' })).rejects.toThrow(
      'URL host is not allowed',
    )
  })

  it('extracts a source URL from pasted text', () => {
    expect(sourceUrlFromText('See https://example.com/path?x=1 for details')).toBe(
      'https://example.com/path?x=1',
    )
    expect(sourceUrlFromText('no link here')).toBe('')
  })
})
