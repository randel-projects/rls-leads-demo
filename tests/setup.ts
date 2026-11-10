import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL's auto-cleanup registers via a global afterEach — which does not exist
// because vitest globals are OFF in this repo's config. This line is
// load-bearing: without it, DOM state bleeds between tests.
afterEach(cleanup)
