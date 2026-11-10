import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'

const DEMO_USERS = ['userA@test.com', 'userB@test.com']
const DEMO_PASSWORD = 'demo1234'

export default function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })
        if (error) throw error
        if (!data.session) {
          setInfo(
            'Almost there — check your inbox for a confirmation link. (If email confirmation was left on in the Supabase dashboard, this demo intended to have it off.)',
          )
        }
        // With a session, onAuthStateChange in App switches screens.
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="center-screen">
      <div className="auth-wrap">
        <div className="brand-row brand-hero">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <span className="brand-name">RLS Leads Demo</span>
        </div>

        <div className="card auth-card">
          <span className="badge">LIVE DEMO</span>
          <h1>One table. One policy. Two users.</h1>
          <p className="muted">
            Multi-user CRUD where <strong>Postgres row-level security</strong>{' '}
            decides what each signed-in user can see. Sign in as two users in
            two browser windows — each sees only their own rows. The app code
            filters nothing; the database does all of it.
          </p>

          <div className="tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'signin'}
              className={mode === 'signin' ? 'tab active' : 'tab'}
              onClick={() => {
                setMode('signin')
                setError(null)
                setInfo(null)
              }}
            >
              Sign in
            </button>
            <button
              role="tab"
              aria-selected={mode === 'signup'}
              className={mode === 'signup' ? 'tab active' : 'tab'}
              onClick={() => {
                setMode('signup')
                setError(null)
                setInfo(null)
              }}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6+ characters"
              />
            </label>

            {error && (
              <p className="form-message error" role="alert">
                {error}
              </p>
            )}
            {info && (
              <p className="form-message info" role="status">
                {info}
              </p>
            )}

            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="demo-box">
            <strong>Try the demo yourself</strong>
            <p>
              Open this page in a <em>second browser window</em> and sign in as
              the other user. Each account sees only its own leads.
            </p>
            <p className="demo-hint">Click an account to fill the form:</p>
            <ul>
              {DEMO_USERS.map((u) => (
                <li key={u}>
                  <button
                    type="button"
                    className="chip-btn"
                    title="Fill the form with this demo account"
                    onClick={() => {
                      setEmail(u)
                      setPassword(DEMO_PASSWORD)
                      setError(null)
                      setInfo(null)
                    }}
                  >
                    <code>{u}</code>
                  </button>
                  <span>
                    {' '}· password <code>{DEMO_PASSWORD}</code>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="security-note">
          The public anon key is embedded in this page <em>by design</em> — it
          grants nothing on its own. Postgres row-level security is the
          security layer.
        </p>
      </div>
    </main>
  )
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('Invalid login credentials'))
    return 'Wrong email or password.'
  if (msg.includes('already registered'))
    return 'That email is already registered — switch to “Sign in”.'
  if (msg.toLowerCase().includes('email not confirmed'))
    return 'This email still needs confirmation — use a demo account or a fresh signup.'
  if (/invalid format|invalid email/i.test(msg))
    return 'That doesn’t look like a complete email address — click a demo account below and try again.'
  if (msg.toLowerCase().includes('rate limit'))
    return 'Supabase sends only a couple of confirmation emails per hour on the free tier. This demo is meant to run with email confirmation OFF — in the Supabase dashboard: Authentication → Sign In / Providers → Email → turn off “Confirm email”. Then sign up again; no email is sent at all.'
  if (msg.includes('not allowed'))
    return 'New signups are switched off in the Supabase dashboard — turn Email on under Authentication → Sign In / Providers.'
  return msg
}
