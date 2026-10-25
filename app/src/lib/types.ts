export type MediaType = 'movie' | 'series'

export interface Source {
  /** stable id used for download bookkeeping */
  id: string
  /** human label: "Auto", "1080p", "720p"… */
  label: string
  url: string
  kind: 'hls' | 'mp4'
  /** for mp4 variants, the tallied quality */
  quality?: string
  /** bytes, when the feed tells us */
  size?: number
  /** extra request headers the host requires */
  headers?: Record<string, string>
}

export interface Person {
  name: string
  role?: string
  photo?: string
}

export interface Episode {
  id: string
  season: number
  number: number
  title: string
  overview?: string
  runtime?: string
  still?: string
  airDate?: string
  sources?: Source[]
}

export interface Season {
  number: number
  name?: string
  episodes: Episode[]
}

export interface Title {
  id: string
  type: MediaType
  title: string
  originalTitle?: string
  year?: number
  endYear?: number
  rating?: number
  votes?: number
  certification?: string
  runtime?: string
  genres: string[]
  overview?: string
  poster?: string
  backdrop?: string
  logo?: string
  trailerKey?: string
  cast?: Person[]
  director?: string
  creators?: string[]
  language?: string
  status?: string
  provider?: string
  collection?: { id: string; title: string; poster?: string; year?: number }[]
  episodeCount?: number
  seasonCount?: number
  /** playback sources for a movie, or the "play first episode" default */
  sources?: Source[]
  seasons?: Season[]
  similar?: string[]
  /** true for the bundled offline catalog shipped with the app */
  demo?: boolean
  /** deep link back to cinejoy.pk */
  pageUrl?: string
}

export interface Feed {
  items: Title[]
  demo: boolean
  /** where the data came from — surfaced in Settings/About */
  origin: string
  fetchedAt: number
}

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'complete' | 'failed'

export interface DownloadItem {
  key: string
  titleId: string
  titleName: string
  type: MediaType
  /** e.g. "S1 E2 · Chapter 2" */
  subtitle?: string
  poster?: string
  sourceId: string
  sourceLabel: string
  url: string
  kind: 'hls' | 'mp4'
  quality?: string
  status: DownloadStatus
  downloaded: number
  total: number
  /** Blob-store key for the finished file */
  blobKey?: string
  error?: string
  createdAt: number
  updatedAt: number
  /** movie or episode id this belongs to (used to resume playback) */
  mediaId: string
  season?: number
  episode?: number
}

export interface HistoryEntry {
  mediaId: string
  titleId: string
  type: MediaType
  titleName: string
  poster?: string
  season?: number
  episode?: number
  episodeTitle?: string
  position: number
  duration: number
  updatedAt: number
}

export interface WatchlistEntry {
  titleId: string
  addedAt: number
}

export interface Settings {
  autoplayNext: boolean
  defaultQuality: 'auto' | '1080p' | '720p' | '480p'
  wifiOnlyDownloads: boolean
  dataSaver: boolean
  matureContent: boolean
  apiBase: string
  useLiveFeed: boolean
}
