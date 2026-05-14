export function createFixedWindowRateLimiter(options = {}) {
  const maxRequests = positiveInteger(options.maxRequests ?? 20, 20)
  const windowMs = positiveInteger(options.windowMs ?? 60_000, 60_000)
  const now = options.now ?? (() => Date.now())
  const buckets = new Map()

  return {
    check(key) {
      const bucketKey = key || 'unknown'
      const currentTime = now()
      const existing = buckets.get(bucketKey)
      const bucket =
        existing && existing.resetAt > currentTime
          ? existing
          : {
              count: 0,
              resetAt: currentTime + windowMs,
            }

      if (bucket.count >= maxRequests) {
        buckets.set(bucketKey, bucket)
        return {
          allowed: false,
          remaining: 0,
          resetAt: bucket.resetAt,
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000)),
        }
      }

      bucket.count += 1
      buckets.set(bucketKey, bucket)
      return {
        allowed: true,
        remaining: maxRequests - bucket.count,
        resetAt: bucket.resetAt,
        retryAfterSeconds: 0,
      }
    },
    reset() {
      buckets.clear()
    },
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}
