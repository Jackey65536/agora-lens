import { describe, expect, it } from 'vitest'

import { sha256Hex } from './sha256'

describe('sha256Hex', () => {
  it('matches standard SHA-256 test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('hashes unicode strings consistently', () => {
    expect(sha256Hex('中文 macro signal')).toBe('8796cb7c3ab1f003f956d78d4b6c5ae84102cf5fab527a8acd8f4a62647d87a4')
  })
})
