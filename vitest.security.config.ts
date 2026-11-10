import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import './tests/node20-shims'

// Live-API tier: runs against the real Supabase project. Env plumbing keeps the
// same test file working locally (reads .env.local's VITE_* values) and in CI
// (SUPABASE_URL / SUPABASE_ANON_KEY set directly). Both values are public by
// design — the anon key ships in the client bundle and RLS is the protection.
const local = loadEnv('test', process.cwd(), 'VITE_')

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/security/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ?? local.VITE_SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? local.VITE_SUPABASE_ANON_KEY,
    },
  },
})
