import { describe, expect, it } from 'vitest'
import { friendlyError } from '../../src/components/AuthScreen'

// Strings below are byte-exact with AuthScreen.tsx (em dashes, curly quotes).
describe('friendlyError', () => {
  it('maps invalid credentials to a friendly line', () => {
    expect(friendlyError(new Error('Invalid login credentials'))).toBe(
      'Wrong email or password.'
    )
  })

  it('maps already-registered to the switch-to-sign-in hint', () => {
    expect(friendlyError(new Error('User already registered'))).toBe(
      'That email is already registered — switch to “Sign in”.'
    )
  })

  it('maps unconfirmed email case-insensitively', () => {
    expect(friendlyError(new Error('EMAIL NOT CONFIRMED'))).toBe(
      'This email still needs confirmation — use a demo account or a fresh signup.'
    )
  })

  it('maps invalid email format via regex, both spellings', () => {
    expect(friendlyError(new Error('invalid format'))).toBe(
      'That doesn’t look like a complete email address — click a demo account below and try again.'
    )
    expect(friendlyError(new Error('Invalid email address'))).toBe(
      'That doesn’t look like a complete email address — click a demo account below and try again.'
    )
  })

  it('maps rate limit to the free-tier guidance', () => {
    const msg = friendlyError(new Error('Rate limit reached')) as string
    expect(msg.startsWith('Supabase sends only')).toBe(true)
  })

  it('maps signup-not-allowed to the dashboard hint', () => {
    expect(friendlyError(new Error('Signups not allowed for this instance'))).toBe(
      'New signups are switched off in the Supabase dashboard — turn Email on under Authentication → Sign In / Providers.'
    )
  })

  it('returns unknown messages verbatim (fallback)', () => {
    expect(friendlyError(new Error('something odd happened'))).toBe(
      'something odd happened'
    )
  })

  it('stringifies non-Error inputs', () => {
    expect(friendlyError('plain failure')).toBe('plain failure')
    expect(friendlyError({})).toBe('[object Object]')
  })

  it('checks the regex branch before rate limit (source order)', () => {
    // A message containing both triggers the /invalid format|invalid email/i
    // branch, because it is tested before the rate-limit substring branch.
    expect(friendlyError(new Error('invalid email due to rate limit'))).toBe(
      'That doesn’t look like a complete email address — click a demo account below and try again.'
    )
  })
})
