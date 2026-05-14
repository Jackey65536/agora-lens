import { describe, expect, it } from 'vitest'

import { createFixedWindowRateLimiter } from './rateLimiter.mjs'

describe('fixed window rate limiter', () => {
  it('allows requests up to the configured limit', () => {
    let now = 1_000
    const limiter = createFixedWindowRateLimiter({
      maxRequests: 2,
      now: () => now,
      windowMs: 60_000,
    })

    expect(limiter.check('client-a')).toMatchObject({ allowed: true, remaining: 1 })
    expect(limiter.check('client-a')).toMatchObject({ allowed: true, remaining: 0 })
    expect(limiter.check('client-a')).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
    })

    now += 60_000
    expect(limiter.check('client-a')).toMatchObject({ allowed: true, remaining: 1 })
  })

  it('tracks different client keys independently', () => {
    const limiter = createFixedWindowRateLimiter({
      maxRequests: 1,
      now: () => 1_000,
      windowMs: 60_000,
    })

    expect(limiter.check('client-a')).toMatchObject({ allowed: true })
    expect(limiter.check('client-a')).toMatchObject({ allowed: false })
    expect(limiter.check('client-b')).toMatchObject({ allowed: true })
  })

  it('uses safe defaults for invalid configuration', () => {
    const limiter = createFixedWindowRateLimiter({
      maxRequests: 0,
      now: () => 1_000,
      windowMs: -1,
    })

    for (let index = 0; index < 20; index += 1) {
      expect(limiter.check('client-a')).toMatchObject({ allowed: true })
    }

    expect(limiter.check('client-a')).toMatchObject({
      allowed: false,
      retryAfterSeconds: 60,
    })
  })
})
