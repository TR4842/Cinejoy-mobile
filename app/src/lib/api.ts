import { CATALOG } from './catalog'
import type { Feed, Title } from './types'

export const DEFAULT_API_BASE = ''

const REQUIRED = ['id', 'title', 'type'] as const

function looksLikeTitle(v: unknown): v is Title {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return REQUIRED.every((k) => typeof o[k] === 'string') || (typeof o.id === 'string' && typeof o.title === 'string' && (o.type === 'movie' || o.type === 'series'))
}

function normaliseFeed(raw: unknown, origin: string): Feed | null {
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : null
  if (!items) return null
  const clean = items.filter(looksLikeTitle).map((t) => ({
    ...t,
    genres: Array.isArray(t.genres) ? t.genres : [],
  }))
  if (!clean.length) return null
  return { items: clean, demo: false, origin, fetchedAt: Date.now() }
}

/**
 * Load the catalog. With the live feed enabled we ask the companion scraper
 * (`server/`) for fresh cinejoy.pk data and fall back to the bundled sample
 * whenever the network, the host or the scraper is unavailable.
 */
export async function loadFeed(opts: { apiBase?: string; live?: boolean; signal?: AbortSignal } = {}): Promise<Feed> {
  const base = (opts.apiBase ?? '').replace(/\/$/, '')
  if (opts.live !== false) {
    try {
      const res = await fetch(`${base}/api/catalog?limit=160`, {
        signal: opts.signal,
        headers: { accept: 'application/json' },
      })
      if (res.ok) {
        const json = await res.json()
        const feed = normaliseFeed(json, base ? `Live feed · ${base}` : 'Live feed · cinejoy.pk')
        if (feed) return feed
      }
    } catch {
      /* offline or scraper not running — use bundled catalog */
    }
  }
  return {
    items: CATALOG,
    demo: true,
    origin: 'Bundled sample catalog',
    fetchedAt: Date.now(),
  }
}

export function byId(items: Title[], id: string | undefined): Title | undefined {
  if (!id) return undefined
  return items.find((t) => t.id === id)
}

export function byType(items: Title[], type: Title['type']): Title[] {
  return items.filter((t) => t.type === type)
}

export function trending(items: Title[]): Title[] {
  return [...items].sort((a, b) => (b.rating ?? 0) * Math.log10((b.votes ?? 10) + 10) - (a.rating ?? 0) * Math.log10((a.votes ?? 10) + 10))
}

export function latest(items: Title[]): Title[] {
  return [...items].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
}

export function allGenres(items: Title[]): string[] {
  const set = new Set<string>()
  items.forEach((t) => t.genres.forEach((g) => set.add(g)))
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function search(items: Title[], query: string): Title[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return items
    .map((t) => {
      const hay = `${t.title} ${t.year ?? ''} ${t.genres.join(' ')} ${(t.cast ?? []).map((c) => c.name).join(' ')}`.toLowerCase()
      const idx = hay.indexOf(q)
      if (idx === -1) return null
      const starts = t.title.toLowerCase().startsWith(q)
      return { t, score: (starts ? 100 : 0) + (starts ? 0 : Math.max(0, 30 - idx)) + (t.rating ?? 0) }
    })
    .filter((x): x is { t: Title; score: number } => !!x)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t)
}

export function similar(items: Title[], t: Title, count = 12): Title[] {
  return items
    .filter((o) => o.id !== t.id)
    .map((o) => {
      let score = 0
      if (o.type === t.type) score += 2
      o.genres.forEach((g) => {
        if (t.genres.includes(g)) score += 3
      })
      if (o.year && t.year && Math.abs(o.year - t.year) <= 3) score += 2
      return { o, score: score + (o.rating ?? 0) / 20 }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((x) => x.o)
}

export function providers(items: Title[]): { name: string; count: number }[] {
  const map = new Map<string, number>()
  items.forEach((t) => {
    if (t.provider) map.set(t.provider, (map.get(t.provider) ?? 0) + 1)
  })
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}
