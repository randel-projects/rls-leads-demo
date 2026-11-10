import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isConfigured } from './lib/supabase'
import AuthScreen from './components/AuthScreen'
import LeadsApp from './components/LeadsApp'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    )
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isConfigured || !supabase) return <SetupNotice />
  if (loading) return <FullScreenSpinner />
  return session ? <LeadsApp session={session} /> : <AuthScreen />
}

/** Shown when .env.local has no Supabase values yet. */
function SetupNotice() {
  return (
    <main className="center-screen">
      <div className="card setup-card">
        <div className="brand-row">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <span className="brand-name">RLS Leads Demo</span>
        </div>
        <h1>Not configured yet</h1>
        <p className="muted">
          This demo needs a Supabase project before it can run. Copy{' '}
          <code>.env.example</code> to <code>.env.local</code> and fill in{' '}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>{' '}
          from your Supabase dashboard (Project Settings → API). Full steps are
          in the README.
        </p>
      </div>
    </main>
  )
}

function FullScreenSpinner() {
  return (
    <main className="center-screen" aria-busy="true">
      <span className="spinner" aria-label="Loading" />
    </main>
  )
}
