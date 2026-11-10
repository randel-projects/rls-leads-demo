import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthScreen from '../../src/components/AuthScreen'
import {
  createSupabaseMock,
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

beforeEach(() => {
  holder.current = createSupabaseMock()
})

function auth() {
  return (holder.current as SupabaseMock).auth
}

describe('AuthScreen', () => {
  it('defaults to the Sign in tab', () => {
    render(<AuthScreen />)
    expect(screen.getByRole('tab', { name: 'Sign in' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('tab', { name: 'Sign up' })).toHaveAttribute(
      'aria-selected',
      'false'
    )
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('switches to signup mode from the tab', async () => {
    const user = userEvent.setup()
    render(<AuthScreen />)
    await user.click(screen.getByRole('tab', { name: 'Sign up' }))
    expect(screen.getByRole('tab', { name: 'Sign up' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })

  it('demo-account chips fill the form', async () => {
    const user = userEvent.setup()
    render(<AuthScreen />)
    await user.click(screen.getByRole('button', { name: 'userA@test.com' }))
    expect(screen.getByLabelText('Email')).toHaveValue('userA@test.com')
    expect(screen.getByLabelText('Password')).toHaveValue('demo1234')
  })

  it('signs in with a trimmed email', async () => {
    const user = userEvent.setup()
    render(<AuthScreen />)
    await user.type(screen.getByLabelText('Email'), '  userA@test.com  ')
    await user.type(screen.getByLabelText('Password'), 'demo1234')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(auth().signInWithPassword).toHaveBeenCalledWith({
      email: 'userA@test.com',
      password: 'demo1234',
    })
  })

  it('shows a friendly alert on invalid credentials', async () => {
    const user = userEvent.setup()
    // Real auth-js errors are Error subclasses (AuthApiError), and the
    // component re-throws that value into friendlyError — so the stub must
    // be an Error instance too, or the mapping falls back to String(err).
    auth().signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: Object.assign(new Error('Invalid login credentials'), {
        status: 400,
      }),
    })
    render(<AuthScreen />)
    await user.click(screen.getByRole('button', { name: 'userB@test.com' }))
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Wrong email or password.'
    )
  })

  it('shows the confirmation info after a sessionless signup', async () => {
    const user = userEvent.setup()
    render(<AuthScreen />)
    await user.click(screen.getByRole('tab', { name: 'Sign up' }))
    await user.type(screen.getByLabelText('Email'), 'someone@example.com')
    await user.type(screen.getByLabelText('Password'), 'password1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(auth().signUp).toHaveBeenCalledWith({
      email: 'someone@example.com',
      password: 'password1',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Almost there')
  })

  it('disables the submit button while busy', async () => {
    const user = userEvent.setup()
    let resolveSignIn!: (value: unknown) => void
    auth().signInWithPassword.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve
        })
    )
    render(<AuthScreen />)
    await user.click(screen.getByRole('button', { name: 'userA@test.com' }))
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    const busy = screen.getByRole('button', { name: 'Working…' })
    expect(busy).toBeDisabled()
    resolveSignIn({ data: { session: null }, error: null })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
    })
  })

  it('clears a stale error when switching tabs', async () => {
    const user = userEvent.setup()
    auth().signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: Object.assign(new Error('Invalid login credentials'), {
        status: 400,
      }),
    })
    render(<AuthScreen />)
    await user.click(screen.getByRole('button', { name: 'userA@test.com' }))
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Sign up' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
