import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../../src/App'
import {
  createSupabaseMock,
  makeSession,
  type SupabaseMock,
} from '../helpers/supabaseMock'

// LeadsApp becomes reachable once a session exists; keep its data layer inert
// so App-level tests never produce unhandled rejections.
vi.mock('../../src/lib/leadsRepository', () => ({
  listLeads: vi.fn(async () => ({ data: [], error: null })),
  addLead: vi.fn(),
  deleteLead: vi.fn(),
}))

// vi.mock factories are hoisted, so the mutable holder must be hoisted too;
// getters keep every import-site lookup live across per-test swaps.
const holder = vi.hoisted(() => ({
  current: null as SupabaseMock | null,
}))
vi.mock('../../src/lib/supabase', () => ({
  get supabase() {
    return holder.current?.supabase ?? null
  },
  get isConfigured() {
    return holder.current?.isConfigured ?? false
  },
}))

beforeEach(() => {
  holder.current = createSupabaseMock()
})

function auth() {
  return (holder.current as SupabaseMock).auth
}

describe('App', () => {
  it('shows the setup notice when unconfigured', async () => {
    holder.current = createSupabaseMock({ isConfigured: false })
    render(<App />)
    expect(await screen.findByText(/Not configured yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull()
  })

  it('shows a full-screen spinner while the session is restored', () => {
    auth().getSession.mockImplementation(() => new Promise(() => {}))
    const { container } = render(<App />)
    expect(container.querySelector('main[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelector('span.spinner')).not.toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('renders the auth screen when there is no session', async () => {
    render(<App />)
    expect(await screen.findByRole('tab', { name: 'Sign up' })).toBeInTheDocument()
  })

  it('renders LeadsApp when a session exists', async () => {
    holder.current = createSupabaseMock({ session: makeSession('userA@test.com') })
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.getByText('userA@test.com')).toBeInTheDocument()
  })

  it('swaps back to the auth screen on SIGNED_OUT', async () => {
    holder.current = createSupabaseMock({ session: makeSession('userA@test.com') })
    render(<App />)
    await screen.findByRole('button', { name: 'Sign out' })
    const cb = auth().onAuthStateChange.mock.calls[0][0] as (
      event: string,
      session: unknown
    ) => void
    act(() => {
      cb('SIGNED_OUT', null)
    })
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('swaps the signed-in user on SIGNED_IN', async () => {
    holder.current = createSupabaseMock({ session: makeSession('userA@test.com') })
    render(<App />)
    await screen.findByText('userA@test.com')
    const cb = auth().onAuthStateChange.mock.calls[0][0] as (
      event: string,
      session: unknown
    ) => void
    act(() => {
      cb('SIGNED_IN', makeSession('userB@test.com'))
    })
    expect(await screen.findByText('userB@test.com')).toBeInTheDocument()
    expect(screen.queryByText('userA@test.com')).toBeNull()
  })

  it('unsubscribes from auth state changes on unmount', async () => {
    const { unmount } = render(<App />)
    await screen.findByRole('tab', { name: 'Sign up' })
    const result = auth().onAuthStateChange.mock.results[0].value as {
      data: { subscription: { unsubscribe: () => void } }
    }
    expect(auth().onAuthStateChange).toHaveBeenCalledTimes(1)
    unmount()
    expect(result.data.subscription.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
