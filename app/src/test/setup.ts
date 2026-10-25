import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { configure } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { idbClear } from '../lib/db'

// CI runners are slower than a dev box; the 1s default is too tight for the
// catalog fetch + IndexedDB round-trips.
configure({ asyncUtilTimeout: 8000 })

// jsdom has no media pipeline; stub just enough for the player to mount.
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
})
Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: vi.fn(),
})
Object.defineProperty(HTMLMediaElement.prototype, 'load', {
  configurable: true,
  value: vi.fn(),
})
Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
  configurable: true,
  get: () => 60,
})
Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
  configurable: true,
  get() {
    return (this as unknown as { __t?: number }).__t ?? 0
  },
  set(v: number) {
    ;(this as unknown as { __t?: number }).__t = v
  },
})

if (!('requestFullscreen' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'requestFullscreen', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  })
}

beforeEach(() => {
  localStorage.clear()
  // No backend during tests: the app must fall back to the bundled catalog.
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  )
})

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  // fake-indexeddb keeps the same database across tests in a file
  await Promise.all([
    idbClear('blobs').catch(() => undefined),
    idbClear('downloads').catch(() => undefined),
    idbClear('history').catch(() => undefined),
    idbClear('watchlist').catch(() => undefined),
  ])
})
