import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { timeAgo } from '../../src/components/LeadsApp'

const NOW = Date.parse('2026-11-10T12:00:00Z')

// Pin the clock, not the locale: the ≥7d branch formats with the runtime
// locale, so it is asserted by shape (regex), never by exact string.
const secondsAgo = (s: number) => new Date(NOW - s * 1000).toISOString()

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("'just now' under 45s", () => {
    expect(timeAgo(secondsAgo(10))).toBe('just now')
    expect(timeAgo(secondsAgo(44))).toBe('just now')
  })

  it("'0m ago' at exactly 45s (documents the current boundary)", () => {
    // floor(45/60) = 0 — an honest quirk of the existing implementation.
    expect(timeAgo(secondsAgo(45))).toBe('0m ago')
  })

  it('minute boundaries', () => {
    expect(timeAgo(secondsAgo(60))).toBe('1m ago')
    expect(timeAgo(secondsAgo(59 * 60 + 59))).toBe('59m ago')
  })

  it('hour boundaries', () => {
    expect(timeAgo(secondsAgo(3600))).toBe('1h ago')
    expect(timeAgo(secondsAgo(23 * 3600 + 59 * 60 + 59))).toBe('23h ago')
  })

  it('day boundaries', () => {
    expect(timeAgo(secondsAgo(24 * 3600))).toBe('1d ago')
    expect(timeAgo(secondsAgo(6 * 86400 + 23 * 3600 + 59 * 60))).toBe('6d ago')
  })

  it('switches to a date at 7 days (locale-proof shape)', () => {
    expect(timeAgo(secondsAgo(7 * 86400))).toMatch(/^[A-Za-z]{3,9} \d{1,2}$/)
  })
})
