import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import ws from 'ws'
import type { WebSocketLikeConstructor } from '@supabase/realtime-js'
import {
  createClient,
  type PostgrestError,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js'

// ws is runtime-compatible but doesn't structurally match supabase's
// browser-shaped transport typing, hence the cast.
const wsTransport = ws as unknown as WebSocketLikeConstructor

// Live-API tier: automates SPEC's hand-run RLS matrix against the real
// Supabase project. NO signUp anywhere — the two demo users are permanent
// and there is no cleanup path for new auth users. All env values are the
// project's public anon credentials (same ones in the deployed bundle).
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

let clientA: SupabaseClient
let clientB: SupabaseClient
let sessionA: Session
let sessionB: Session
let leadAId: string
let leadBId: string

const runId = `${new Date()
  .toISOString()
  .replace(/[-:T]/g, '')
  .slice(0, 12)}-${Math.random().toString(36).slice(2, 6)}`
const nameA = `A-${runId} seed lead`
const nameB = `B-${runId} seed lead`

const touched: { client: SupabaseClient; id: string }[] = []

function pointerFor(error: unknown): Error {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.includes('Invalid login credentials')) {
    return new Error(
      'Demo sign-in failed: invalid credentials. userA@test.com / userB@test.com with password demo1234 must exist in this Supabase project (see README → "Try it in 60 seconds").'
    )
  }
  return new Error(
    `Could not reach the Supabase project (${msg}). The free tier pauses projects after ~1 week of inactivity — wake it in the Supabase dashboard, then re-run. (The weekly CI cron is best-effort keep-warm.)`
  )
}

async function seedLead(
  client: SupabaseClient,
  name: string
): Promise<{ id: string; owner_id: string }> {
  const { data, error } = await client
    .from('leads')
    .insert({ name, note: null })
    .select()
    .single()
  if (error) throw new Error(`seed insert failed: ${error.message}`)
  touched.push({ client, id: (data as { id: string }).id })
  return data as { id: string; owner_id: string }
}

async function listFor(client: SupabaseClient): Promise<
  { id: string; name: string; owner_id: string }[]
> {
  const { data, error } = await client
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
  expect(error).toBeNull()
  return (data ?? []) as { id: string; name: string; owner_id: string }[]
}

beforeAll(async () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_ANON_KEY are missing. Locally: copy .env.example to .env.local (both values are public by design). In CI they are set inline — see .github/workflows/tests.yml.'
    )
  }
  // Node < 22 has no WebSocket constructor realtime-js accepts; this suite
  // never uses realtime, but createClient initializes it eagerly — hand it
  // the ws transport to keep init quiet.
  const anon = { auth: { persistSession: false }, realtime: { transport: wsTransport } }
  clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, anon)
  clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, anon)

  for (const [client, email] of [
    [clientA, 'userA@test.com'],
    [clientB, 'userB@test.com'],
  ] as const) {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password: 'demo1234',
    })
    if (error) throw pointerFor(error)
    if (!data.session) throw new Error(`no session returned for ${email}`)
    if (email === 'userA@test.com') sessionA = data.session
    else sessionB = data.session
  }

  leadAId = (await seedLead(clientA, nameA)).id
  leadBId = (await seedLead(clientB, nameB)).id
})

afterAll(async () => {
  // Best-effort: every seeded lead is deleted by its OWNER. Failures are
  // logged, not thrown — the per-run unique prefixes make stale rows harmless.
  for (const { client, id } of touched) {
    const { error } = await client.from('leads').delete().eq('id', id)
    if (error) console.warn(`cleanup failed for ${id}:`, error.message)
  }
})

describe('RLS matrix (live)', () => {
  it('A sees only rows owned by A', async () => {
    const rows = await listFor(clientA)
    expect(rows.some((r) => r.id === leadAId)).toBe(true)
    for (const row of rows) {
      expect(row.owner_id).toBe(sessionA.user.id)
    }
  })

  it('B sees only rows owned by B', async () => {
    const rows = await listFor(clientB)
    expect(rows.some((r) => r.id === leadBId)).toBe(true)
    for (const row of rows) {
      expect(row.owner_id).toBe(sessionB.user.id)
    }
  })

  it('cross-visibility: neither user sees the other\'s seeded lead', async () => {
    const rowsA = await listFor(clientA)
    const rowsB = await listFor(clientB)
    expect(rowsA.some((r) => r.name.startsWith(`B-${runId}`))).toBe(false)
    expect(rowsB.some((r) => r.name.startsWith(`A-${runId}`))).toBe(false)
  })

  it('anon sees zero rows, silently', async () => {
    const anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
      realtime: { transport: wsTransport },
    })
    const { data, error } = await anon
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('insert without owner_id defaults ownership to the JWT uid', async () => {
    // seedLead omits owner_id; verify the returned row is owned by A.
    const rows = await listFor(clientA)
    const mine = rows.find((r) => r.id === leadAId)
    expect(mine?.owner_id).toBe(sessionA.user.id)
  })

  it('tampering owner_id is rejected by WITH CHECK', async () => {
    const { data, error } = await clientA
      .from('leads')
      .insert({ name: `A-${runId} stolen`, note: null, owner_id: sessionB.user.id })
      .select()
      .single()
    expect(data).toBeNull()
    expect(error).not.toBeNull()
    // Code pinned from the live project on 2026-11-10: 42501 (Postgres
    // insufficient_privilege), not PostgREST's 425000 variant.
    expect((error as PostgrestError).code).toBe('42501')
    expect((error as PostgrestError).message).toBe(
      'new row violates row-level security policy for table "leads"'
    )
  })

  it('cross-user DELETE is a silent no-op; the row survives', async () => {
    const { error } = await clientA.from('leads').delete().eq('id', leadBId)
    expect(error).toBeNull()
    const rowsB = await listFor(clientB)
    expect(rowsB.some((r) => r.id === leadBId)).toBe(true)
  })
})
