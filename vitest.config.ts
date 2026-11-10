import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import './tests/node20-shims'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.tsx'],
    clearMocks: true,
  },
})
