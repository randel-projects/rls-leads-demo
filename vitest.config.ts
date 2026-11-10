import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Node 20 shim: vitest 5.1's error formatter uses Map.groupBy (Node 21+).
// Without this, a FAILING test crashes the reporter instead of printing why.
// No-op on Node >= 21 (and on CI's Node 22).
if (typeof (Map as unknown as Record<string, unknown>).groupBy !== 'function') {
  ;(Map as unknown as Record<symbol | string, unknown>).groupBy = function (
    this: MapConstructor,
    items: Iterable<unknown>,
    key: (item: unknown, index: number) => unknown
  ) {
    const out = new Map()
    let i = 0
    for (const item of items) {
      const k = key(item, i++)
      const bucket = out.get(k) ?? []
      bucket.push(item)
      out.set(k, bucket)
    }
    return out
  }
}

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.tsx'],
    clearMocks: true,
  },
})
