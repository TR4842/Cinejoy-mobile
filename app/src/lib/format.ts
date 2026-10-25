import type { Title } from './types'

const TMDB = 'https://image.tmdb.org/t/p'

/** TMDB path ("/abc.jpg") or absolute URL -> usable src */
export function img(path: string | undefined, size: 'w200' | 'w300' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500'): string | undefined {
  if (!path) return undefined
  if (/^https?:/i.test(path)) return path
  return `${TMDB}/${size}${path}`
}

export function year(t: Pick<Title, 'year' | 'endYear'>): string {
  if (!t.year) return ''
  if (t.endYear && t.endYear !== t.year) return `${t.year}–${t.endYear}`
  return String(t.year)
}

export function rating(v: number | undefined): string {
  if (!v || Number.isNaN(v)) return ''
  return v.toFixed(1)
}

export function runtimeLabel(t: Pick<Title, 'runtime' | 'type' | 'seasonCount'>): string {
  if (t.type === 'series') return t.seasonCount ? `${t.seasonCount} season${t.seasonCount > 1 ? 's' : ''}` : 'Series'
  return t.runtime || ''
}

export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const s = Math.floor(seconds % 60)
  const m = Math.floor((seconds / 60) % 60)
  const h = Math.floor(seconds / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function bytes(n: number | undefined): string {
  if (!n || n <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

export function ago(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function episodeCode(season?: number, episode?: number): string {
  if (season == null || episode == null) return ''
  return `S${season} E${episode}`
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
}
