import { describe, expect, it } from 'vitest'
import { briefIdFromSearch, shareUrlForBrief } from './briefArchive'

describe('brief archive helpers', () => {
  it('extracts a safe brief id from a query string', () => {
    expect(briefIdFromSearch('?brief=brief_20260514120000_abcd1234')).toBe(
      'brief_20260514120000_abcd1234',
    )
    expect(briefIdFromSearch('?brief=../../etc/passwd')).toBeNull()
  })

  it('builds a share URL without dropping existing params', () => {
    expect(shareUrlForBrief('brief_1', 'https://example.com/demo?lang=en')).toBe(
      'https://example.com/demo?lang=en&brief=brief_1',
    )
  })
})
