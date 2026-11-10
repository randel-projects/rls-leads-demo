import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { listLeads, addLead as insertLead, deleteLead } from '../lib/leadsRepository'
import type { Lead } from '../lib/types'

export default function LeadsApp({ session }: { session: Session }) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void load()
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setError(null)
    const { data, error } = await listLeads()
    if (error) setError(error.message)
    else setLeads(data)
    setLoading(false)
  }

  async function addLead(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setAdding(true)
    setError(null)
    const { data, error } = await insertLead(trimmed, note.trim() || null)
    if (error) {
      setError(error.message)
    } else if (data) {
      setLeads((prev) => [data, ...prev])
      setName('')
      setNote('')
    }
    setAdding(false)
  }

  function requestDelete(id: string) {
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    if (confirmId === id) {
      void doDelete(id)
      return
    }
    setConfirmId(id)
    confirmTimer.current = setTimeout(() => setConfirmId(null), 4000)
  }

  async function doDelete(id: string) {
    setConfirmId(null)
    setError(null)
    const { error } = await deleteLead(id)
    // RLS makes deleting another user's row a silent no-op — but it can't be
    // in our list anyway, because RLS never showed it to us.
    if (error) setError(error.message)
    else setLeads((prev) => prev.filter((l) => l.id !== id))
  }

  async function signOut() {
    await supabase!.auth.signOut()
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-row">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <span className="brand-name">RLS Leads Demo</span>
        </div>
        <div className="topbar-right">
          <span className="user-chip" title="Signed-in user">
            <span className="dot" aria-hidden="true" />
            {session.user.email}
          </span>
          <button className="btn btn-ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <main className="content">
        <p className="strip">
          <strong>What you see is what Postgres returns.</strong> This app
          filters nothing — you see only your own rows because of one RLS
          policy. Sign in as the other demo user in a second browser window and
          this list changes.
        </p>

        <form className="card add-card" onSubmit={addLead}>
          <div className="add-fields">
            <input
              className="grow"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lead name — e.g. “Sydney Café — POS enquiry”"
              aria-label="Lead name"
              required
            />
            <input
              className="grow"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              aria-label="Note (optional)"
            />
            <button className="btn btn-primary" disabled={adding || !name.trim()}>
              {adding ? 'Adding…' : 'Add lead'}
            </button>
          </div>
          {error && (
            <p className="form-message error" role="alert">
              {error}
            </p>
          )}
        </form>

        {loading ? (
          <ul className="lead-list" aria-busy="true">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </ul>
        ) : leads.length === 0 ? (
          <div className="card empty-state">
            <span className="empty-icon" aria-hidden="true">
              ◌
            </span>
            <h2>No leads yet</h2>
            <p className="muted">
              Add one above — then sign in as the other demo user in a second
              browser window and watch this list stay empty for them.
            </p>
          </div>
        ) : (
          <ul className="lead-list">
            {leads.map((lead) => (
              <li key={lead.id} className="card lead-row">
                <span className="avatar" aria-hidden="true">
                  {lead.name.charAt(0).toUpperCase()}
                </span>
                <div className="lead-text">
                  <span className="lead-name">{lead.name}</span>
                  {lead.note && <span className="lead-note">{lead.note}</span>}
                </div>
                <span className="lead-time">{timeAgo(lead.created_at)}</span>
                <button
                  className={
                    confirmId === lead.id
                      ? 'btn btn-danger-confirm'
                      : 'btn btn-danger-ghost'
                  }
                  onClick={() => requestDelete(lead.id)}
                  aria-label={
                    confirmId === lead.id
                      ? `Confirm delete ${lead.name}`
                      : `Delete ${lead.name}`
                  }
                >
                  {confirmId === lead.id ? 'Delete — sure?' : 'Delete'}
                </button>
              </li>
            ))}
          </ul>
        )}

        <footer className="footer muted">
          One table (<code>leads</code>) · one policy · Supabase (Postgres) +
          React + Vercel · full walkthrough in the README
        </footer>
      </main>
    </div>
  )
}

function SkeletonRow() {
  return (
    <li className="card lead-row skeleton-row" aria-hidden="true">
      <span className="avatar skeleton" />
      <div className="lead-text">
        <span className="skeleton skeleton-line w40" />
        <span className="skeleton skeleton-line w25" />
      </div>
    </li>
  )
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
