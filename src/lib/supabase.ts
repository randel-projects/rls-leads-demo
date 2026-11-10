import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * The anon key is public by design: it identifies the project but grants no
 * rows by itself — every table is protected by row-level security, so the
 * database decides what each signed-in user can see. That is the whole point
 * of this demo.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

export const isConfigured = supabase !== null
