import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG } from '../lib/catalog'
import { idbAll, idbGet } from '../lib/db'
import { StoreProvider, useStore } from '../lib/store'
import type { DownloadItem } from '../lib/types'

function wrapper({ children }: { children: React.ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>
}

const movie = CATALOG.find((t) => t.id === '1290418')!
const mp4 = movie.sources!.find((s) => s.kind === 'mp4')!
const hls = movie.sources!.find((s) => s.kind === 'hls')!

function streamedResponse(bytes: number, total = bytes) {
  const payload = new Uint8Array(bytes).fill(7)
  return new Response(payload, {
    status: 200,
    headers: { 'content-length': String(total), 'content-type': 'video/mp4' },
  })
}

describe('download manager', () => {
  beforeEach(async () => {
    vi.unstubAllGlobals()
  })

  it('downloads a file into IndexedDB and marks it complete', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(streamedResponse(48 * 1024))))
    const { result } = renderHook(() => useStore(), { wrapper })

    // wait for the bundled catalog
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(10))

    result.current.startDownload({ title: movie, source: mp4 })

    await waitFor(
      () => {
        const item = result.current.downloads[0]
        expect(item?.status).toBe('complete')
      },
      { timeout: 5000 },
    )

    const item = result.current.downloads[0]
    expect(item.key).toBe(`${movie.id}::${mp4.id}`)
    expect(item.downloaded).toBe(48 * 1024)
    expect(item.blobKey).toBe(item.key)

    // The bytes are handed to IndexedDB under the download key. (fake-indexeddb
    // can't structured-clone a jsdom Blob, so we assert the record exists here
    // and rely on the Playwright-free browser behaviour for the payload.)
    const blob = await idbGet<Blob>('blobs', item.key)
    expect(blob).toBeDefined()
    expect(item.downloaded).toBe(48 * 1024)

    const persisted = await idbAll<DownloadItem>('downloads')
    expect(persisted.find((p) => p.key === item.key)?.status).toBe('complete')
    expect(result.current.downloadForMedia(movie.id)?.sourceId).toBe(mp4.id)
  })

  it('records a failure with a readable reason when the network blocks the file', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const { result } = renderHook(() => useStore(), { wrapper })
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(10))

    result.current.startDownload({ title: movie, source: mp4 })

    await waitFor(() => expect(result.current.downloads[0]?.status).toBe('failed'), { timeout: 5000 })
    expect(result.current.downloads[0].error).toMatch(/CORS|blocked/i)
    expect(result.current.toast).toBeTypeOf('function')
  })

  it('never queues an adaptive playlist as a file download', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(streamedResponse(1024))))
    const { result } = renderHook(() => useStore(), { wrapper })
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(10))

    result.current.startDownload({ title: movie, source: hls })
    await waitFor(() => expect(result.current.downloads).toHaveLength(1))
    expect(result.current.downloads[0].kind).toBe('hls')
    // hls entries are surfaced so the user sees why nothing lands on disk
    expect(result.current.toasts.some((t) => /playlist|MP4/i.test(t.message))).toBe(true)
  })

  it('removes files and their blob when a download is deleted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(streamedResponse(2048))))
    const { result } = renderHook(() => useStore(), { wrapper })
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(10))

    result.current.startDownload({ title: movie, source: mp4 })
    await waitFor(() => expect(result.current.downloads[0]?.status).toBe('complete'), { timeout: 5000 })
    const key = result.current.downloads[0].key

    result.current.removeDownload(key)

    await waitFor(() => expect(result.current.downloads).toHaveLength(0))
    await waitFor(async () => expect(await idbGet('blobs', key)).toBeUndefined())
  })

  it('keeps watch progress per episode and exposes resume points', async () => {
    const { result } = renderHook(() => useStore(), { wrapper })
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(10))

    result.current.saveProgress({
      mediaId: '96677-s1e1',
      titleId: '96677',
      type: 'series',
      titleName: 'Lupin',
      season: 1,
      episode: 1,
      episodeTitle: 'Chapter 1',
      position: 600,
      duration: 2820,
    })

    await waitFor(() => expect(result.current.history).toHaveLength(1))
    expect(result.current.resumeFor('96677')?.position).toBe(600)
    expect(result.current.history[0].episode).toBe(1)
  })

  it('adds and removes titles from My List', async () => {
    const { result } = renderHook(() => useStore(), { wrapper })
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(10))

    expect(result.current.inWatchlist(movie.id)).toBe(false)
    result.current.toggleWatchlist(movie.id)
    await waitFor(() => expect(result.current.inWatchlist(movie.id)).toBe(true))
    result.current.toggleWatchlist(movie.id)
    await waitFor(() => expect(result.current.inWatchlist(movie.id)).toBe(false))
  })
})
