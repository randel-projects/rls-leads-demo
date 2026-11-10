// The only file that talks to the leads table. Kept deliberately thin — no
// interface, no injected client, nothing to wire up — so that "the app
// filters nothing" stays auditable in one place, and so component tests can
// mock three plain functions.
import { supabase } from './supabase'
import type { Lead } from './types'

export async function listLeads() {
  // NOTE: deliberately NO client-side filtering here. What this list shows
  // is exactly what Postgres returns for the signed-in user — the RLS
  // policy is the only thing deciding visibility. That is the demo.
  const { data, error } = await supabase!
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
  return { data: (data ?? []) as Lead[], error }
}

export async function addLead(name: string, note: string | null) {
  // owner_id is not sent — the database defaults it to auth.uid() and the
  // policy's WITH CHECK enforces it. The client cannot insert for
  // someone else.
  const { data, error } = await supabase!
    .from('leads')
    .insert({ name, note })
    .select()
    .single()
  return { data: (data ?? null) as Lead | null, error }
}

export async function deleteLead(id: string) {
  const { data, error } = await supabase!.from('leads').delete().eq('id', id)
  return { data: (data ?? null) as Lead | null, error }
}
