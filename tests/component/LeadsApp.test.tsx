import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeadsApp from '../../src/components/LeadsApp'
import type { Lead } from '../../src/lib/types'
import {
  createSupabaseMock,
  makeSession,
  type SupabaseMock,
} from '../helpers/supabaseMock'

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

// Auto-mocked: every export becomes an empty vi.fn we resolve per test.
vi.mock('../../src/lib/leadsRepository')
import { addLead, deleteLead, listLeads } from '../../src/lib/leadsRepository'
import { PostgrestError } from '@supabase/supabase-js'

// Real class, same as production failures — components read error.message.
const pgError = (message: string): PostgrestError =>
  new PostgrestError({ message, details: '', hint: '', code: 'XX999' })

let seq = 0
const makeLead = (name: string): Lead => ({
  id: `lead-${++seq}`,
  name,
  note: null,
  owner_id: '11111111-1111-1111-1111-111111111111',
  created_at: new Date().toISOString(),
})

beforeEach(() => {
  holder.current = createSupabaseMock()
  seq = 0
  vi.mocked(listLeads).mockResolvedValue({ data: [], error: null })
  vi.mocked(addLead).mockResolvedValue({ data: null, error: null })
  vi.mocked(deleteLead).mockResolvedValue({ data: null, error: null })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function auth() {
  return (holder.current as SupabaseMock).auth
}

function renderLeads() {
  return render(<LeadsApp session={makeSession('userA@test.com')} />)
}

describe('LeadsApp — load', () => {
  it('shows skeleton rows while the first load is pending', () => {
    vi.mocked(listLeads).mockImplementation(() => new Promise(() => {}))
    const { container } = renderLeads()
    const list = container.querySelector('ul.lead-list')
    expect(list).not.toBeNull()
    expect(list).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('li[aria-hidden="true"]')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull()
  })

  it('renders leads in the order Postgres returned them', async () => {
    vi.mocked(listLeads).mockResolvedValue({
      data: [makeLead('Fresh lead'), makeLead('Old lead')],
      error: null,
    })
    renderLeads()
    await screen.findByText('Fresh lead')
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Fresh lead')
    expect(items[1]).toHaveTextContent('Old lead')
  })

  it('shows the empty state when there are no leads', async () => {
    renderLeads()
    expect(await screen.findByText('No leads yet')).toBeInTheDocument()
  })

  it('shows a load error as an alert', async () => {
    vi.mocked(listLeads).mockResolvedValue({
      data: [],
      error: pgError('boom'),
    })
    renderLeads()
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
  })
})

describe('LeadsApp — add', () => {
  it('sends name and note, never an owner_id, and prepends the result', async () => {
    const user = userEvent.setup()
    let resolveAdd!: (value: { data: Lead | null; error: null }) => void
    vi.mocked(addLead).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAdd = resolve
        })
    )
    renderLeads()
    await screen.findByText('No leads yet')
    await user.type(screen.getByLabelText('Lead name'), 'Alpha')
    await user.type(screen.getByLabelText('Note (optional)'), 'note text')
    await user.click(screen.getByRole('button', { name: 'Add lead' }))

    // The two-arg signature IS the ownership proof at this tier: the client
    // cannot even express an owner_id. (Real enforcement: the live RLS tests.)
    expect(addLead).toHaveBeenCalledWith('Alpha', 'note text')
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled()

    resolveAdd({ data: makeLead('Alpha'), error: null })
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.getByLabelText('Lead name')).toHaveValue('')
    expect(screen.getByLabelText('Note (optional)')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Add lead' })).toBeInTheDocument()
  })

  it('passes null when the note is blank', async () => {
    const user = userEvent.setup()
    renderLeads()
    await screen.findByText('No leads yet')
    await user.type(screen.getByLabelText('Lead name'), 'Beta')
    await user.click(screen.getByRole('button', { name: 'Add lead' }))
    expect(addLead).toHaveBeenCalledWith('Beta', null)
  })

  it('keeps the inputs and shows an alert when the insert fails', async () => {
    const user = userEvent.setup()
    vi.mocked(addLead).mockResolvedValueOnce({
      data: null,
      error: pgError('insert failed'),
    })
    renderLeads()
    await screen.findByText('No leads yet')
    await user.type(screen.getByLabelText('Lead name'), 'Gamma')
    await user.click(screen.getByRole('button', { name: 'Add lead' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('insert failed')
    expect(screen.getByLabelText('Lead name')).toHaveValue('Gamma')
  })

  it('disables Add until the name is non-blank', async () => {
    const user = userEvent.setup()
    renderLeads()
    await screen.findByText('No leads yet')
    const add = screen.getByRole('button', { name: 'Add lead' })
    expect(add).toBeDisabled()
    await user.type(screen.getByLabelText('Lead name'), 'X')
    expect(add).toBeEnabled()
  })
})

describe('LeadsApp — delete', () => {
  it('requires two clicks, then removes the row', async () => {
    const user = userEvent.setup()
    vi.mocked(listLeads).mockResolvedValue({
      data: [makeLead('Alpha')],
      error: null,
    })
    renderLeads()
    await screen.findByText('Alpha')
    await user.click(screen.getByRole('button', { name: 'Delete Alpha' }))
    const confirm = screen.getByRole('button', { name: 'Confirm delete Alpha' })
    expect(confirm).toHaveTextContent('Delete — sure?')
    await user.click(confirm)
    expect(deleteLead).toHaveBeenCalledWith('lead-1')
    await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull())
  })

  it('auto-resets the armed state after 4s; a single click re-arms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(listLeads).mockResolvedValue({
      data: [makeLead('Alpha')],
      error: null,
    })
    renderLeads()
    await screen.findByText('Alpha')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha' }))
    expect(
      screen.getByRole('button', { name: 'Confirm delete Alpha' })
    ).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.getByRole('button', { name: 'Delete Alpha' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha' }))
    expect(
      screen.getByRole('button', { name: 'Confirm delete Alpha' })
    ).toBeInTheDocument()
    expect(deleteLead).not.toHaveBeenCalled()
  })

  it('keeps the row and shows an alert when the delete fails', async () => {
    const user = userEvent.setup()
    vi.mocked(listLeads).mockResolvedValue({
      data: [makeLead('Alpha')],
      error: null,
    })
    vi.mocked(deleteLead).mockResolvedValueOnce({
      data: null,
      error: pgError('delete failed'),
    })
    renderLeads()
    await screen.findByText('Alpha')
    await user.click(screen.getByRole('button', { name: 'Delete Alpha' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete Alpha' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('delete failed')
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })
})

describe('LeadsApp — session', () => {
  it('signs out through supabase auth', async () => {
    const user = userEvent.setup()
    renderLeads()
    await screen.findByText('No leads yet')
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(auth().signOut).toHaveBeenCalledTimes(1)
  })

  it('shows the signed-in email in the user chip', async () => {
    renderLeads()
    await screen.findByText('No leads yet')
    const chip = screen.getByTitle('Signed-in user')
    expect(chip).toHaveTextContent('userA@test.com')
  })
})
