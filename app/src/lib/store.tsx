import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_API_BASE, loadFeed } from './api'
import { idbAll, idbDelete, idbPut, storageEstimate } from './db'
import type {
  DownloadItem,
  Episode,
  Feed,
  HistoryEntry,
  Settings,
  Source,
  Title,
} from './types'

const SETTINGS_KEY = 'cinejoy.settings.v1'
const WATCHLIST_KEY = 'cinejoy.watchlist.v1'

const DEFAULT_SETTINGS: Settings = {
  autoplayNext: true,
  defaultQuality: 'auto',
  wifiOnlyDownloads: false,
  dataSaver: false,
  matureContent: true,
  apiBase: DEFAULT_API_BASE,
  useLiveFeed: true,
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as object) } as T
  } catch {
    return fallback
  }
}

function readArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

type Toast = { id: number; message: string; tone?: 'ok' | 'error' }

interface StoreValue {
  feed: Feed | null
  items: Title[]
  loading: boolean
  refreshFeed: () => Promise<void>
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  downloads: DownloadItem[]
  activeCount: number
  startDownload: (args: { title: Title; episode?: Episode; source: Source }) => string
  pauseDownload: (key: string) => void
  resumeDownload: (key: string) => void
  retryDownload: (key: string) => void
  removeDownload: (key: string) => void
  deleteAllDownloads: () => void
  downloadForMedia: (mediaId: string) => DownloadItem | undefined
  history: HistoryEntry[]
  saveProgress: (entry: Omit<HistoryEntry, 'updatedAt'>) => void
  removeHistory: (mediaId: string) => void
  clearHistory: () => void
  resumeFor: (titleId: string) => HistoryEntry | undefined
  watchlist: string[]
  inWatchlist: (titleId: string) => boolean
  toggleWatchlist: (titleId: string) => void
  storage: { usage: number; quota: number }
  toasts: Toast[]
  toast: (message: string, tone?: 'ok' | 'error') => void
}

const StoreContext = createContext<StoreValue | null>(null)

const MAX_CONCURRENT_DOWNLOADS = 2

function messageOf(err: unknown): string {
  if (err instanceof Error) {
    if (/failed to fetch|networkerror|load failed/i.test(err.message)) {
      return 'Network blocked this file (CORS). Try another quality or download from the live server.'
    }
    if (/abort/i.test(err.message)) return 'Paused'
    return err.message
  }
  return 'Download failed'
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings>(() => readJSON(SETTINGS_KEY, DEFAULT_SETTINGS))
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [watchlist, setWatchlist] = useState<string[]>(() => readArray(WATCHLIST_KEY))
  const [storage, setStorage] = useState({ usage: 0, quota: 0 })
  const [toasts, setToasts] = useState<Toast[]>([])

  const controllers = useRef(new Map<string, AbortController>())
  const downloadsRef = useRef<DownloadItem[]>([])
  downloadsRef.current = downloads

  // ------------------------------------------------------------- bootstrap
  const refreshFeed = useCallback(async () => {
    setLoading(true)
    const next = await loadFeed({ apiBase: settings.apiBase, live: settings.useLiveFeed })
    setFeed(next)
    setLoading(false)
  }, [settings.apiBase, settings.useLiveFeed])

  useEffect(() => {
    void refreshFeed()
  }, [refreshFeed])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [recorded, hist] = await Promise.all([
          idbAll<DownloadItem>('downloads'),
          idbAll<HistoryEntry>('history'),
        ])
        if (!alive) return
        // Anything left mid-flight from a previous session is resumable, not live.
        setDownloads(recorded.map((d) => (d.status === 'downloading' ? { ...d, status: 'paused' } : d)))
        setHistory(hist.sort((a, b) => b.updatedAt - a.updatedAt))
      } catch {
        /* storage disabled (private mode) — app still works */
      }
      try {
        setStorage(await storageEstimate())
      } catch {
        /* ignore */
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* ignore */
    }
  }, [settings])

  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist))
    } catch {
      /* ignore */
    }
  }, [watchlist])

  const toast = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, tone }])
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200)
  }, [])

  // ------------------------------------------------------------- downloads
  const patchDownload = useCallback((key: string, patch: Partial<DownloadItem>) => {
    setDownloads((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...patch, updatedAt: Date.now() } : d)),
    )
  }, [])

  const persist = useCallback(async (item: DownloadItem) => {
    try {
      await idbPut('downloads', item)
    } catch {
      /* ignore */
    }
  }, [])

  const runDownload = useCallback(
    async (item: DownloadItem) => {
      const ctrl = new AbortController()
      controllers.current.set(item.key, ctrl)
      patchDownload(item.key, { status: 'downloading', downloaded: 0, error: undefined })
      let final: Partial<DownloadItem> = { status: 'failed', error: 'Download stopped' }
      try {
        const res = await fetch(item.url, { signal: ctrl.signal, cache: 'no-store' })
        if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`)
        const total = Number(res.headers.get('content-length') ?? 0) || item.total || 0
        const mime =
          res.headers.get('content-type') || (item.kind === 'hls' ? 'application/vnd.apple.mpegurl' : 'video/mp4')
        const reader = res.body?.getReader()
        if (!reader) {
          // No streaming support — fall back to a single buffered read.
          const blob = await res.blob()
          await idbPut('blobs', blob, item.key)
          final = { status: 'complete', downloaded: blob.size, total: blob.size, blobKey: item.key, error: undefined }
        } else {
          const chunks: BlobPart[] = []
          let received = 0
          let lastFlush = 0
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value as BlobPart)
            received += value.byteLength
            const now = Date.now()
            if (now - lastFlush > 400) {
              lastFlush = now
              patchDownload(item.key, { downloaded: received, total })
            }
          }
          const blob = new Blob(chunks, { type: mime })
          await idbPut('blobs', blob, item.key)
          final = {
            status: 'complete',
            downloaded: blob.size,
            total: blob.size || total,
            blobKey: item.key,
            error: undefined,
          }
        }
        patchDownload(item.key, final)
        toast(`${item.titleName} saved offline`)
        setStorage(await storageEstimate())
      } catch (err) {
        final = ctrl.signal.aborted
          ? { status: 'paused' }
          : { status: 'failed', error: messageOf(err) }
        patchDownload(item.key, final)
      } finally {
        controllers.current.delete(item.key)
        // Persist the resolved state directly: reading `downloads` here can
        // still be one render behind and would save a stale "downloading" row.
        void persist({ ...item, ...final, updatedAt: Date.now() })
      }
    },
    [patchDownload, persist, toast],
  )

  // Persist finished / failed downloads (progress itself stays in memory).
  useEffect(() => {
    downloads.forEach((d) => {
      if (d.status === 'complete' || d.status === 'failed' || d.status === 'paused') void persist(d)
    })
  }, [downloads, persist])

  // Simple queue: keep at most MAX_CONCURRENT_DOWNLOADS running.
  useEffect(() => {
    const running = downloads.filter((d) => d.status === 'downloading')
    if (running.length >= MAX_CONCURRENT_DOWNLOADS) return
    const next = downloads.find((d) => d.status === 'queued')
    if (next) void runDownload(next)
  }, [downloads, runDownload])

  const startDownload = useCallback<StoreValue['startDownload']>(
    ({ title, episode, source }) => {
      const mediaId = episode?.id ?? title.id
      const existing = downloadsRef.current.find((d) => d.mediaId === mediaId && d.sourceId === source.id)
      if (existing && existing.status !== 'failed') {
        toast('Already in your downloads')
        return existing.key
      }
      const key = `${mediaId}::${source.id}`
      const item: DownloadItem = {
        key,
        titleId: title.id,
        titleName: title.title,
        type: title.type,
        subtitle: episode ? `S${episode.season} E${episode.number} · ${episode.title}` : undefined,
        poster: title.poster,
        sourceId: source.id,
        sourceLabel: source.label,
        url: source.url,
        kind: source.kind,
        quality: source.quality ?? source.label,
        status: 'queued',
        downloaded: 0,
        total: source.size ?? 0,
        mediaId,
        season: episode?.season,
        episode: episode?.number,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setDownloads((prev) => [item, ...prev.filter((d) => d.key !== key)])
      if (source.kind === 'hls') {
        toast('This title only exposes a streaming playlist — offline saves need an MP4 source.', 'error')
      } else {
        toast('Download queued')
      }
      return key
    },
    [downloads, toast],
  )

  const pauseDownload = useCallback((key: string) => {
    controllers.current.get(key)?.abort()
    patchDownload(key, { status: 'paused' })
  }, [patchDownload])

  const resumeDownload = useCallback(
    (key: string) => {
      patchDownload(key, { status: 'queued', error: undefined })
    },
    [patchDownload],
  )

  const retryDownload = useCallback(
    (key: string) => {
      patchDownload(key, { status: 'queued', error: undefined, downloaded: 0 })
    },
    [patchDownload],
  )

  const removeDownload = useCallback(
    (key: string) => {
      controllers.current.get(key)?.abort()
      controllers.current.delete(key)
      setDownloads((prev) => prev.filter((d) => d.key !== key))
      void idbDelete('downloads', key)
      void idbDelete('blobs', key)
      void storageEstimate().then(setStorage)
    },
    [],
  )

  const deleteAllDownloads = useCallback(() => {
    controllers.current.forEach((c) => c.abort())
    controllers.current.clear()
    setDownloads([])
    void (async () => {
      const all = await idbAll<DownloadItem>('downloads').catch(() => [])
      await Promise.all(all.map((d) => idbDelete('blobs', d.key).catch(() => undefined)))
      await idbAll<DownloadItem>('downloads')
        .then((rows) => Promise.all(rows.map((r) => idbDelete('downloads', r.key))))
        .catch(() => undefined)
      setStorage(await storageEstimate())
    })()
  }, [])

  const downloadForMedia = useCallback(
    (mediaId: string) => downloads.find((d) => d.mediaId === mediaId && d.status === 'complete'),
    [downloads],
  )

  // --------------------------------------------------------------- history
  const saveProgress = useCallback((entry: Omit<HistoryEntry, 'updatedAt'>) => {
    if (!entry.duration || entry.duration < 30) return
    const next: HistoryEntry = { ...entry, updatedAt: Date.now() }
    setHistory((prev) => [next, ...prev.filter((h) => h.mediaId !== entry.mediaId)].slice(0, 120))
    void idbPut('history', next).catch(() => undefined)
  }, [])

  const removeHistory = useCallback((mediaId: string) => {
    setHistory((prev) => prev.filter((h) => h.mediaId !== mediaId))
    void idbDelete('history', mediaId).catch(() => undefined)
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    void idbAll<HistoryEntry>('history')
      .then((rows) => Promise.all(rows.map((r) => idbDelete('history', r.mediaId))))
      .catch(() => undefined)
  }, [])

  const resumeFor = useCallback(
    (titleId: string) => history.find((h) => h.titleId === titleId && h.duration - h.position > 20),
    [history],
  )

  // ------------------------------------------------------------- watchlist
  const inWatchlist = useCallback((titleId: string) => watchlist.includes(titleId), [watchlist])

  const toggleWatchlist = useCallback(
    (titleId: string) => {
      setWatchlist((prev) => {
        const has = prev.includes(titleId)
        toast(has ? 'Removed from My List' : 'Added to My List')
        return has ? prev.filter((id) => id !== titleId) : [titleId, ...prev]
      })
    },
    [toast],
  )

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      feed,
      items: feed?.items ?? [],
      loading,
      refreshFeed,
      settings,
      updateSettings,
      downloads,
      activeCount: downloads.filter((d) => d.status === 'downloading').length,
      startDownload,
      pauseDownload,
      resumeDownload,
      retryDownload,
      removeDownload,
      deleteAllDownloads,
      downloadForMedia,
      history,
      saveProgress,
      removeHistory,
      clearHistory,
      resumeFor,
      watchlist,
      inWatchlist,
      toggleWatchlist,
      storage,
      toasts,
      toast,
    }),
    [
      feed,
      loading,
      refreshFeed,
      settings,
      updateSettings,
      downloads,
      startDownload,
      pauseDownload,
      resumeDownload,
      retryDownload,
      removeDownload,
      deleteAllDownloads,
      downloadForMedia,
      history,
      saveProgress,
      removeHistory,
      clearHistory,
      resumeFor,
      watchlist,
      inWatchlist,
      toggleWatchlist,
      storage,
      toasts,
      toast,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
