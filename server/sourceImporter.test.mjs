import { describe, expect, it } from 'vitest'

import {
  importSource,
  normalizeSourceUrl,
  validateImportInput,
} from './sourceImporter.mjs'

describe('source importer', () => {
  it('turns a research note into a signal with deduped source references', async () => {
    const result = await importSource(
      {
        sourceTitle: 'Desk note',
        sourceUrl: 'https://research.example.com/note?id=1&utm_source=x#section',
        text: 'Two market desks expect an Arc stablecoin-native trading agent announcement next week.',
        type: 'research',
      },
      { now: new Date('2026-05-15T01:00:00.000Z') },
    )

    expect(result.signal).toMatchObject({
      receivedAt: '2026-05-15T01:00:00.000Z',
      source: 'research',
      sourceLabel: 'Desk note',
      title: 'Desk note',
    })
    expect(result.signal.text).toContain('stablecoin-native trading agent')
    expect(result.signal.sources).toHaveLength(1)
    expect(result.signal.sources?.[0]).toMatchObject({
      capturedAt: '2026-05-15T01:00:00.000Z',
      sourceType: 'research',
      title: 'Desk note',
      url: 'https://research.example.com/note?id=1',
    })
  })

  it('imports RSS items, preserving item URLs and published timestamps', async () => {
    const rss = `<?xml version="1.0"?>
      <rss><channel><title>Market Feed</title>
        <item>
          <title>Prediction venue lists new energy market</title>
          <link>https://example.com/a?utm_campaign=noise</link>
          <pubDate>Fri, 15 May 2026 00:30:00 GMT</pubDate>
          <description>Spanish energy policy traders are watching solar payment rules.</description>
        </item>
        <item>
          <title>Duplicate permalink</title>
          <link>https://example.com/a</link>
          <description>This should dedupe to the first item.</description>
        </item>
      </channel></rss>`

    const result = await importSource(
      { type: 'rss', url: 'https://feeds.example.com/markets.xml' },
      {
        fetchText: async () => ({
          contentType: 'application/rss+xml',
          finalUrl: 'https://feeds.example.com/markets.xml',
          text: rss,
        }),
        lookupHostname: async () => ['93.184.216.34'],
        now: new Date('2026-05-15T01:02:00.000Z'),
      },
    )

    expect(result.signal.source).toBe('news')
    expect(result.signal.sourceLabel).toBe('Market Feed')
    expect(result.signal.text).toContain('Prediction venue lists new energy market')
    expect(result.signal.text).toContain('Spanish energy policy traders')
    expect(result.signal.sources).toHaveLength(1)
    expect(result.signal.sources?.[0]).toMatchObject({
      publishedAt: '2026-05-15T00:30:00.000Z',
      title: 'Prediction venue lists new energy market',
      url: 'https://example.com/a',
    })
  })

  it('imports a webpage as a source URL signal', async () => {
    const result = await importSource(
      { type: 'url', url: 'https://news.example.com/story' },
      {
        fetchText: async () => ({
          contentType: 'text/html; charset=utf-8',
          finalUrl: 'https://news.example.com/story',
          text: `
            <html><head><title>Arc agents enter prediction markets</title></head>
            <body><nav>Skip this</nav><article>
              <p>Circle Arc builders are testing agents that translate Mandarin macro news into prediction markets.</p>
            </article><script>ignored()</script></body></html>
          `,
        }),
        lookupHostname: async () => ['93.184.216.34'],
        now: new Date('2026-05-15T01:04:00.000Z'),
      },
    )

    expect(result.signal).toMatchObject({
      source: 'news',
      sourceLabel: 'news.example.com',
      title: 'Arc agents enter prediction markets',
    })
    expect(result.signal.text).toContain('translate Mandarin macro news')
    expect(result.signal.text).not.toContain('ignored')
    expect(result.signal.text).not.toContain('Skip this')
  })

  it('rejects unsafe remote URLs before fetching', async () => {
    await expect(
      importSource(
        { type: 'url', url: 'http://127.0.0.1:18080/private' },
        { fetchText: async () => { throw new Error('should not fetch') } },
      ),
    ).rejects.toThrow('URL host is not allowed')

    expect(() => validateImportInput({ type: 'rss', url: 'ftp://example.com/feed.xml' })).toThrow(
      'URL must use http or https',
    )
  })

  it('normalizes URLs for duplicate detection', () => {
    expect(normalizeSourceUrl('https://example.com/a?utm_source=x&b=1#section')).toBe(
      'https://example.com/a?b=1',
    )
  })
})
