import { vi } from 'vitest'
import type { Mock } from 'vitest'
import type { Session } from '@supabase/supabase-js'

export interface SupabaseAuthMock {
  getSession: Mock
  onAuthStateChange: Mock
  signInWithPassword: Mock
  signUp: Mock
  signOut: Mock
}

export interface SupabaseMock {
  /** The module value `src/lib/supabase` resolves to. */
  supabase: { auth: SupabaseAuthMock } | null
  /** The module value of `isConfigured`. */
  isConfigured: boolean
  /** The auth mock, exposed even when supabase is null, for assertions. */
  auth: SupabaseAuthMock
}

export function createSupabaseMock(
  opts: { isConfigured?: boolean; session?: Session | null } = {}
): SupabaseMock {
  const auth: SupabaseAuthMock = {
    getSession: vi.fn(async () => ({ data: { session: opts.session ?? null } })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signInWithPassword: vi.fn(async () => ({
      data: { user: null, session: null },
      error: null,
    })),
    signUp: vi.fn(async () => ({
      data: { user: null, session: null },
      error: null,
    })),
    signOut: vi.fn(async () => ({ error: null })),
  }
  return {
    supabase: opts.isConfigured === false ? null : { auth },
    isConfigured: opts.isConfigured !== false,
    auth,
  }
}

export function makeSession(email: string): Session {
  return {
    access_token: 'test-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 1,
    refresh_token: 'refresh-token',
    user: {
      id: '11111111-1111-1111-1111-111111111111',
      email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  } as unknown as Session
}
