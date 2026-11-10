import { defineConfig } from '@playwright/test'

// E2E defaults to the LIVE deployment — zero setup for reviewers, and it is
// the artifact users actually see. BASE_URL=http://localhost:5173 npm run test:e2e
// runs the same spec against a local dev server. No webServer: live runs are
// the default. Note: e2e tests the LAST `vercel --prod` deployment, not the
// working tree — redeploy after UI changes before running.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL ?? 'https://demo-website-randel1.vercel.app',
    navigationTimeout: 60_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
})
