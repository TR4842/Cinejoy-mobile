import Hls, { type Level } from 'hls.js'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Back,
  Check,
  Download as DownloadIcon,
  Forward,
  Layers,
  Next,
  Pause,
  Play,
  Refresh,
  Rewind,
  Volume,
  VolumeOff,
  Expand,
  Shrink,
  Wifi,
} from '../components/Icons'
import { MediaCard, Poster, Row, Sheet } from '../components/ui'
import { similar } from '../lib/api'
import { idbGet } from '../lib/db'
import { clock, img, rating } from '../lib/format'
import {
  assetUrl,
  isNative,
  keepAwake,
  openExternal,
  setLandscape,
  vibrate,
} from '../lib/platform'
import { useStore } from '../lib/store'
import type { Episode, Source, Title } from '../lib/types'

interface LoadedSource {
  url: string
  kind: 'hls' | 'mp4'
  label: string
  headers?: Record<string, string>
  offline?: boolean
}

function resolveUrl(u: string): string {
  return /^(https?:|blob:|data:)/i.test(u) ? u : assetUrl(u)
}

export default function Watch() {
  const { id, season, episode } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const store = useStore()
  const { items, settings, history, saveProgress, startDownload, downloads, downloadForMedia, toast } = store

  const title = useMemo(() => items.find((t) => t.id === id), [items, id])
  const seasons = title?.seasons ?? []
  const seasonNum = Number(season) || seasons[0]?.number || 1
  const currentSeason = seasons.find((s) => s.number === seasonNum)
  const episodeNum = Number(episode) || currentSeason?.episodes[0]?.number || 1
  const currentEpisode: Episode | undefined = currentSeason?.episodes.find((e) => e.number === episodeNum)
  const mediaId = currentEpisode?.id ?? title?.id ?? ''
  const sources = currentEpisode?.sources ?? title?.sources ?? []

  const download = downloadForMedia(mediaId)

  const remembered = useMemo(
    () => history.find((h) => h.mediaId === mediaId),
    [history, mediaId],
  )

  const [sourceId, setSourceId] = useState<string>(() => {
    if (settings.defaultQuality === 'auto') return 'auto'
    return settings.defaultQuality
  })
  const [offlineUrl, setOfflineUrl] = useState<string | null>(null)
  const [preferOffline, setPreferOffline] = useState(true)
  const [sheet, setSheet] = useState<null | 'quality' | 'source' | 'download'>(null)
  const [headSizes, setHeadSizes] = useState<Record<string, number>>({})

  // load the saved file for this episode, if there is one
  useEffect(() => {
    let revoked: string | null = null
    setOfflineUrl(null)
    if (!download?.blobKey) return
    let alive = true
    void idbGet<Blob>('blobs', download.blobKey).then((blob) => {
      if (!alive || !blob) return
      revoked = URL.createObjectURL(blob)
      setOfflineUrl(revoked)
    })
    return () => {
      alive = false
      if (revoked) setTimeout(() => URL.revokeObjectURL(revoked!), 0)
    }
  }, [download?.blobKey])

  const activeSource: Source | undefined =
    sources.find((s) => s.id === sourceId) ?? sources.find((s) => s.id === 'auto') ?? sources[0]

  const playback: LoadedSource | null = useMemo(() => {
    if (offlineUrl && preferOffline && download) {
      return { url: offlineUrl, kind: download.kind, label: `Downloaded · ${download.sourceLabel}`, offline: true }
    }
    if (!activeSource) return null
    return {
      url: resolveUrl(activeSource.url),
      kind: activeSource.kind,
      label: activeSource.label,
      headers: activeSource.headers,
    }
  }, [offlineUrl, preferOffline, download, activeSource])

  const nextEpisode = useMemo(() => {
    if (!title || title.type !== 'series') return undefined
    if (!currentSeason) return undefined
    const inSeason = currentSeason.episodes.find((e) => e.number === episodeNum + 1)
    if (inSeason) return inSeason
    const nextSeason = seasons.find((s) => s.number === seasonNum + 1)
    return nextSeason?.episodes[0]
  }, [title, currentSeason, seasons, seasonNum, episodeNum])

  const goToEpisode = useCallback(
    (e: Episode) => navigate(`/watch/${title?.id}/${e.season}/${e.number}`),
    [navigate, title?.id],
  )

  if (!title) {
    return (
      <div className="page page-plain">
        <div className="empty">
          <h3>Title not available</h3>
          <p>The catalog may still be loading.</p>
          <Link className="btn btn-primary" to="/">
            Back home
          </Link>
        </div>
      </div>
    )
  }

  const startAt = Number(params.get('t')) || remembered?.position || 0

  function queueDownload(src: Source) {
    if (!title) return
    if (src.kind === 'hls') {
      toast('Pick an MP4 quality to save offline.', 'error')
      return
    }
    startDownload({ title, episode: currentEpisode, source: src })
    setSheet(null)
  }

  async function probeSizes() {
    const withHeaders = sources.filter((s) => s.kind === 'mp4')
    const entries = await Promise.all(
      withHeaders.map(async (s) => {
        try {
          const res = await fetch(resolveUrl(s.url), { method: 'HEAD' })
          const len = Number(res.headers.get('content-length') ?? 0)
          return [s.id, len] as const
        } catch {
          return [s.id, 0] as const
        }
      }),
    )
    setHeadSizes(Object.fromEntries(entries))
  }

  return (
    <div className="watch-page">
      <VideoStage
        title={title}
        episode={currentEpisode}
        playback={playback}
        sources={sources}
        sourceId={activeSource?.id ?? ''}
        levels={[]}
        startAt={startAt}
        nextEpisode={nextEpisode}
        autoplayNext={settings.autoplayNext}
        onBack={() => navigate(-1)}
        onEnded={() => {
          if (nextEpisode && settings.autoplayNext) goToEpisode(nextEpisode)
        }}
        onNext={() => nextEpisode && goToEpisode(nextEpisode)}
        onSaveProgress={(position, duration) =>
          saveProgress({
            mediaId,
            titleId: title.id,
            type: title.type,
            titleName: title.title,
            poster: title.poster,
            season: currentEpisode?.season,
            episode: currentEpisode?.number,
            episodeTitle: currentEpisode?.title,
            position,
            duration,
          })
        }
        onOpenQuality={() => setSheet('quality')}
        onOpenSource={() => setSheet('source')}
        onOpenDownload={() => {
          setSheet('download')
          void probeSizes()
        }}
        offlineLabel={download ? `Downloaded · ${download.sourceLabel}` : undefined}
        usingOffline={!!playback?.offline}
        onExternal={() => playback && openExternal(playback.url)}
      />

      <div className="watch-body">
        <div className="watch-head">
          <div>
            <h1 className="watch-title">
              {title.title}
              {title.year ? <span className="watch-year"> {title.year}</span> : null}
            </h1>
            <p className="watch-sub">
              {currentEpisode
                ? `S${currentEpisode.season} E${currentEpisode.number} · ${currentEpisode.title}`
                : [title.certification, title.runtime, title.genres[0]].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="watch-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSheet('download')}
              aria-label="Download options"
            >
              <DownloadIcon size={20} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSheet('source')}
              aria-label="Sources"
            >
              <Layers size={20} />
            </button>
          </div>
        </div>

        {playback?.offline && (
          <div className="notice">
            <Wifi size={16} /> Playing from your offline download — no data used.
          </div>
        )}
        {!playback && (
          <div className="notice is-warn">
            No playable source for this title yet. Open the live feed for more options.
          </div>
        )}

        {title.overview && <p className="watch-overview">{title.overview}</p>}

        <div className="meta-grid">
          {title.rating ? (
            <div>
              <span className="meta-label">Rating</span>
              <span className="meta-value">
                ★ {rating(title.rating)}
                {title.votes ? <em> · {title.votes.toLocaleString()}</em> : null}
              </span>
            </div>
          ) : null}
          <div>
            <span className="meta-label">Genres</span>
            <span className="meta-value">{title.genres.slice(0, 3).join(', ') || '—'}</span>
          </div>
          {title.director && (
            <div>
              <span className="meta-label">Director</span>
              <span className="meta-value">{title.director}</span>
            </div>
          )}
          {title.language && (
            <div>
              <span className="meta-label">Language</span>
              <span className="meta-value">{title.language}</span>
            </div>
          )}
        </div>

        {title.cast && title.cast.length > 0 && (
          <Row heading="Cast">
            {title.cast.map((c) => (
              <div key={c.name} className="cast-card">
                <div className="cast-photo">
                  {c.photo ? (
                    <img src={img(c.photo, 'w200')} alt={c.name} loading="lazy" />
                  ) : (
                    <span>{c.name.slice(0, 1)}</span>
                  )}
                </div>
                <span className="cast-name">{c.name}</span>
                {c.role && <span className="cast-role">{c.role}</span>}
              </div>
            ))}
          </Row>
        )}

        {title.type === 'series' && seasons.length > 0 && (
          <EpisodesSection
            seasons={seasons}
            currentSeason={seasonNum}
            currentEpisode={episodeNum}
            titleId={title.id}
            downloads={downloads}
            onSelect={goToEpisode}
          />
        )}

        {title.collection && title.collection.length > 0 && (
          <Row heading="Part of the collection">
            {title.collection.map((c) => (
              <MediaCard
                key={c.id}
                title={{
                  id: c.id,
                  title: c.title,
                  year: c.year,
                  type: 'movie',
                  genres: [],
                  poster: c.poster,
                }}
                width={112}
              />
            ))}
          </Row>
        )}

        <Row heading="You might also like">
          {similar(items, title, 14).map((t) => (
            <MediaCard key={t.id} title={t} width={124} />
          ))}
        </Row>
      </div>

      <Sheet
        open={sheet === 'quality'}
        onClose={() => setSheet(null)}
        title="Playback quality"
      >
        <p className="sheet-note">
          Streams adapt automatically. Pick a fixed quality to save data or force sharpness.
        </p>
        <button type="button" className="list-row" onClick={() => setSheet(null)}>
          <span>Auto</span>
          {sourceId === 'auto' && <Check size={18} />}
        </button>
        <p className="sheet-note">Quality switching is available inside the player once the stream loads.</p>
      </Sheet>

      <Sheet open={sheet === 'source'} onClose={() => setSheet(null)} title="Sources & downloads">
        <p className="sheet-note">
          {download
            ? `Saved offline at ${download.sourceLabel}.`
            : 'Choose a file to stream, or pick an MP4 quality to keep it offline.'}
        </p>
        {sources.map((s) => {
          const done = downloads.find((d) => d.mediaId === mediaId && d.sourceId === s.id && d.status === 'complete')
          return (
            <div key={s.id} className="source-row">
              <button
                type="button"
                className="source-main"
                onClick={() => {
                  setPreferOffline(false)
                  setSourceId(s.id)
                  setSheet(null)
                }}
              >
                <span className="source-label">{s.label}</span>
                <span className="source-kind">
                  {s.kind === 'hls' ? 'Adaptive stream' : `MP4 · ${s.quality ?? s.label}`}
                  {headSizes[s.id] ? ` · ${(headSizes[s.id] / 1048576).toFixed(0)} MB` : ''}
                </span>
              </button>
              {s.kind === 'mp4' ? (
                done ? (
                  <span className="source-done">
                    <Check size={16} /> Saved
                  </span>
                ) : (
                  <button type="button" className="icon-btn" onClick={() => queueDownload(s)} aria-label={`Download ${s.label}`}>
                    <DownloadIcon size={18} />
                  </button>
                )
              ) : (
                <span className="source-tag">stream</span>
              )}
            </div>
          )
        })}
        {download && (
          <button
            type="button"
            className={`btn ${preferOffline ? 'btn-primary' : 'btn-ghost'} btn-block`}
            onClick={() => {
              setPreferOffline((v) => !v)
              setSheet(null)
              toast(preferOffline ? 'Switched to streaming' : 'Playing offline copy')
            }}
          >
            {preferOffline ? 'Playing offline copy' : 'Play the saved file'}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-block" onClick={() => playback && openExternal(playback.url)}>
          Open in another player
        </button>
        {isNative() && <p className="sheet-note">Android build: "Open in another player" hands the stream to your device player.</p>}
      </Sheet>

      <Sheet open={sheet === 'download'} onClose={() => setSheet(null)} title="Download">
        <p className="sheet-note">Files are saved inside the app and play without a connection.</p>
        {sources.filter((s) => s.kind === 'mp4').length === 0 && (
          <p className="sheet-note is-warn">This source is an adaptive playlist only. No MP4 file to save.</p>
        )}
        {sources
          .filter((s) => s.kind === 'mp4')
          .map((s) => {
            const existing = downloads.find((d) => d.mediaId === mediaId && d.sourceId === s.id)
            return (
              <div key={s.id} className="source-row">
                <div className="source-main">
                  <span className="source-label">{s.quality ?? s.label}</span>
                  <span className="source-kind">
                    {headSizes[s.id] ? `${(headSizes[s.id] / 1048576).toFixed(0)} MB` : 'MP4'}
                    {existing?.status === 'complete' ? ' · saved' : ''}
                  </span>
                </div>
                {existing?.status === 'complete' ? (
                  <span className="source-done">
                    <Check size={16} /> Done
                  </span>
                ) : (
                  <button type="button" className="btn btn-small btn-primary" onClick={() => queueDownload(s)}>
                    {existing ? 'Retry' : 'Download'}
                  </button>
                )}
              </div>
            )
          })}
        <Link to="/downloads" className="btn btn-ghost btn-block" onClick={() => setSheet(null)}>
          Go to Downloads
        </Link>
      </Sheet>
    </div>
  )
}

/* ---------------------------------------------------------------- episodes */

function EpisodesSection({
  seasons,
  currentSeason,
  currentEpisode,
  titleId,
  downloads,
  onSelect,
}: {
  seasons: NonNullable<Title['seasons']>
  currentSeason: number
  currentEpisode: number
  titleId: string
  downloads: ReturnType<typeof useStore>['downloads']
  onSelect: (e: Episode) => void
}) {
  const [active, setActive] = useState(currentSeason)
  useEffect(() => setActive(currentSeason), [currentSeason])
  const season = seasons.find((s) => s.number === active) ?? seasons[0]
  return (
    <section className="row episodes">
      <header className="row-head">
        <h2>Episodes</h2>
        {seasons.length > 1 && (
          <select
            className="season-select"
            value={active}
            onChange={(e) => setActive(Number(e.target.value))}
            aria-label="Season"
          >
            {seasons.map((s) => (
              <option key={s.number} value={s.number}>
                Season {s.number}
              </option>
            ))}
          </select>
        )}
      </header>
      <div className="episode-list">
        {season?.episodes.map((e) => {
          const isCurrent = e.season === currentSeason && e.number === currentEpisode
          const saved = downloads.some((d) => d.mediaId === e.id && d.status === 'complete')
          return (
            <button
              key={e.id}
              type="button"
              className={`episode ${isCurrent ? 'is-current' : ''}`}
              onClick={() => onSelect(e)}
            >
              <div className="episode-thumb">
                {e.still ? (
                  <img src={img(e.still, 'w300')} alt="" loading="lazy" />
                ) : (
                  <div className="episode-thumb-fallback">{e.number}</div>
                )}
                {isCurrent ? (
                  <span className="episode-playing">
                    <Play size={14} />
                  </span>
                ) : null}
              </div>
              <div className="episode-copy">
                <div className="episode-title">
                  <span className="episode-num">E{e.number}</span> {e.title}
                </div>
                <div className="episode-meta">
                  {e.runtime}
                  {saved ? ' · Downloaded' : ''}
                </div>
                {e.overview && <p className="episode-overview">{e.overview}</p>}
              </div>
            </button>
          )
        })}
      </div>
      <Link to={`/title/${titleId}`} className="btn btn-ghost btn-block">
        Series details
      </Link>
    </section>
  )
}

/* ------------------------------------------------------------- video stage */

interface StageProps {
  title: Title
  episode?: Episode
  playback: LoadedSource | null
  sources: Source[]
  sourceId: string
  levels: unknown[]
  startAt: number
  nextEpisode?: Episode
  autoplayNext: boolean
  offlineLabel?: string
  usingOffline: boolean
  onBack: () => void
  onEnded: () => void
  onNext: () => void
  onSaveProgress: (position: number, duration: number) => void
  onOpenQuality: () => void
  onOpenSource: () => void
  onOpenDownload: () => void
  onExternal: () => void
}

function VideoStage(props: StageProps) {
  const {
    title,
    episode,
    playback,
    startAt,
    nextEpisode,
    offlineLabel,
    usingOffline,
    onBack,
    onEnded,
    onNext,
    onSaveProgress,
    onOpenSource,
    onOpenDownload,
  } = props

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)

  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [brightness, setBrightness] = useState(1)
  const [waiting, setWaiting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [controls, setControls] = useState(true)
  const [levels, setLevels] = useState<{ index: number; height: number; bitrate: number }[]>([])
  const [currentLevel, setCurrentLevel] = useState(-1)
  const [qualitySheet, setQualitySheet] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [seekPreview, setSeekPreview] = useState<number | null>(null)
  const [hud, setHud] = useState<string | null>(null)
  const [ended, setEnded] = useState(false)
  const [autoNextIn, setAutoNextIn] = useState<number | null>(null)

  const hideTimer = useRef<number | null>(null)
  const progressRef = useRef({ position: 0, duration: 0 })
  const resumeApplied = useRef<string>('')

  const flash = useCallback((message: string) => {
    setHud(message)
    window.setTimeout(() => setHud((cur) => (cur === message ? null : cur)), 900)
  }, [])

  /* ------------------------------------------------------------- source set */
  useEffect(() => {
    const video = videoRef.current
    if (!video || !playback) return
    setError(null)
    setWaiting(true)
    setEnded(false)
    setLevels([])
    hlsRef.current?.destroy()
    hlsRef.current = null

    if (playback.kind === 'hls') {
      const nativeHls = video.canPlayType('application/vnd.apple.mpegurl')
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 24,
          backBufferLength: 30,
          xhrSetup: (xhr) => {
            if (playback.headers) {
              Object.entries(playback.headers).forEach(([k, v]) => {
                try {
                  xhr.setRequestHeader(k, v)
                } catch {
                  /* ignored */
                }
              })
            }
          },
        })
        hlsRef.current = hls
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(playback.url))
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          const seen = new Set<number>()
          const list = data.levels
            .map((l: Level, i: number) => ({ index: i, height: l.height, bitrate: l.bitrate }))
            .filter((l) => (l.height && !seen.has(l.height) && seen.add(l.height)) as boolean)
            .sort((a, b) => b.height - a.height)
          setLevels(list)
          void video.play().catch(() => setControls(true))
        })
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setCurrentLevel(data.level))
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return
          const detail = String(data.details)
          setError(
            /manifest|network/i.test(detail)
              ? 'Could not reach this stream. It may be blocked on your network or offline.'
              : `Playback error: ${detail}`,
          )
          setWaiting(false)
          hls.destroy()
        })
        hls.attachMedia(video)
      } else if (nativeHls) {
        video.src = playback.url
      } else {
        setError('HLS playback is not supported on this device. Try an MP4 source.')
        setWaiting(false)
      }
    } else {
      video.src = playback.url
    }

    const canAutoplay = true
    if (canAutoplay) {
      const onReady = () => void video.play().catch(() => setControls(true))
      video.addEventListener('loadedmetadata', onReady, { once: true })
    }
    return () => {
      video.pause()
    }
  }, [playback?.url, playback?.kind])

  /* --------------------------------------------------------- resume & misc */
  useEffect(() => {
    const video = videoRef.current
    if (!video || !playback) return
    const key = playback.url
    if (resumeApplied.current === key) return
    const onMeta = () => {
      setDuration(video.duration || 0)
      const start = startAt > 5 && startAt < (video.duration || 0) - 20 ? startAt : 0
      if (start > 0) {
        video.currentTime = start
        flash(`Resumed at ${clock(start)}`)
      }
      resumeApplied.current = key
    }
    video.addEventListener('loadedmetadata', onMeta)
    return () => video.removeEventListener('loadedmetadata', onMeta)
  }, [playback?.url, startAt, flash])

  useEffect(() => {
    void keepAwake(true)
    return () => {
      void keepAwake(false)
      void setLandscape(false)
    }
  }, [])

  useEffect(() => {
    const onFs = () => {
      const fs = !!document.fullscreenElement
      setFullscreen(fs)
      if (!fs) void setLandscape(false)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  /* ---------------------------------------------------------- progress save */
  const commitProgress = useCallback(() => {
    const p = progressRef.current
    if (p.duration > 0) onSaveProgress(p.position, p.duration)
  }, [onSaveProgress])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!videoRef.current?.paused) commitProgress()
    }, 5000)
    return () => {
      window.clearInterval(id)
      commitProgress()
    }
  }, [commitProgress])

  /* ------------------------------------------------------------- controls UI */
  const scheduleHide = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      if (!videoRef.current?.paused) setControls(false)
    }, 3600)
  }, [])

  const wakeControls = useCallback(() => {
    setControls(true)
    scheduleHide()
  }, [scheduleHide])

  useEffect(() => {
    if (playing) scheduleHide()
    else {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      setControls(true)
    }
  }, [playing, scheduleHide])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play().catch(() => setError('Tap play again to start playback.'))
      flash('Play')
    } else {
      video.pause()
      flash('Pause')
    }
    void vibrate(8)
    wakeControls()
  }, [flash, wakeControls])

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current
      if (!video) return
      video.currentTime = Math.max(0, Math.min((video.duration || 0) - 0.5, video.currentTime + delta))
      flash(`${delta > 0 ? '+' : ''}${delta}s`)
      wakeControls()
    },
    [flash, wakeControls],
  )

  const toggleFullscreen = useCallback(async () => {
    const el = stageRef.current
    if (!el) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        await setLandscape(false)
      } else if (el.requestFullscreen) {
        await el.requestFullscreen()
        await setLandscape(true)
      } else if (isNative()) {
        setFullscreen(true)
        await setLandscape(true)
      }
    } catch {
      setFullscreen((f) => !f)
    }
  }, [])

  /* ---------------------------------------------------------------- gestures */
  const gesture = useRef({
    active: false,
    startX: 0,
    startY: 0,
    baseTime: 0,
    baseVolume: 1,
    baseBrightness: 1,
    mode: 'none' as 'none' | 'seek' | 'volume' | 'brightness',
    moved: false,
    target: 0,
  })
  const tapTimer = useRef<number | null>(null)
  const lastTap = useRef<{ t: number; x: number }>({ t: 0, x: 0 })

  const onPointerDown = (e: React.PointerEvent) => {
    const video = videoRef.current
    if (!video) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    gesture.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      baseTime: video.currentTime,
      baseVolume: video.volume,
      baseBrightness: brightness,
      mode: 'none',
      moved: false,
      target: video.currentTime,
    }
    ;(e.currentTarget as HTMLElement).setAttribute('data-zone', e.clientX - rect.left < rect.width / 3 ? 'left' : e.clientX - rect.left > (rect.width * 2) / 3 ? 'right' : 'center')
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g.active) return
    const video = videoRef.current
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (g.mode === 'none') {
      if (Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 1.3) g.mode = 'seek'
      else if (Math.abs(dy) > 18) g.mode = e.clientX - rect.left > rect.width / 2 ? 'volume' : 'brightness'
    }
    if (g.mode === 'seek') {
      g.moved = true
      const perPx = Math.max(0.05, (video?.duration || 300) / Math.max(200, rect.width))
      const next = Math.max(0, Math.min((video?.duration || 0) - 0.5, g.baseTime + dx * perPx))
      g.target = next
      setSeekPreview(next)
      return
    }
    if (g.mode === 'volume') {
      g.moved = true
      const v = Math.max(0, Math.min(1, g.baseVolume - dy / 160))
      if (video) video.volume = v
      setVolume(v)
      setMuted(v === 0)
      flash(`Volume ${Math.round(v * 100)}%`)
      return
    }
    if (g.mode === 'brightness') {
      g.moved = true
      const b = Math.max(0.35, Math.min(1.7, g.baseBrightness - dy / 200))
      setBrightness(b)
      flash(`Brightness ${Math.round(b * 100)}%`)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current
    const wasMode = g.mode
    g.active = false
    g.mode = 'none'
    setSeekPreview(null)
    const video = videoRef.current
    if (wasMode === 'seek') {
      if (video) video.currentTime = g.target
      flash(`Seek ${clock(g.target)}`)
      return
    }
    if (g.moved) return
    // taps
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const zone = x < rect.width / 3 ? 'left' : x > (rect.width * 2) / 3 ? 'right' : 'center'
    const now = Date.now()
    const isDouble = now - lastTap.current.t < 300 && Math.abs(e.clientX - lastTap.current.x) < 60
    lastTap.current = { t: now, x: e.clientX }
    if (isDouble) {
      if (tapTimer.current) window.clearTimeout(tapTimer.current)
      tapTimer.current = null
      if (zone === 'left') seekBy(-10)
      else if (zone === 'right') seekBy(10)
      else togglePlay()
      return
    }
    if (tapTimer.current) window.clearTimeout(tapTimer.current)
    tapTimer.current = window.setTimeout(() => {
      setControls((c) => !c)
      if (!controls) scheduleHide()
      tapTimer.current = null
    }, 240)
  }

  /* ----------------------------------------------------------------- events */
  const onTimeUpdate = () => {
    const video = videoRef.current
    if (!video) return
    setTime(video.currentTime)
    progressRef.current = { position: video.currentTime, duration: video.duration || 0 }
    if (video.buffered.length) {
      const end = video.buffered.end(video.buffered.length - 1)
      setBuffered(video.duration ? end / video.duration : 0)
    }
  }

  useEffect(() => {
    if (!ended || !nextEpisode) {
      setAutoNextIn(null)
      return
    }
    setAutoNextIn(6)
    const id = window.setInterval(() => {
      setAutoNextIn((n) => {
        if (n == null) return null
        if (n <= 1) {
          window.clearInterval(id)
          onNext()
          return 0
        }
        return n - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [ended, nextEpisode, onNext])

  const total = duration || 0
  const displayQuality =
    currentLevel >= 0 && levels.find((l) => l.index === currentLevel)?.height
      ? `${levels.find((l) => l.index === currentLevel)!.height}p`
      : levels[0]?.height
        ? 'Auto'
        : playback?.kind === 'mp4'
          ? 'Source'
          : 'Auto'

  return (
    <div
      ref={stageRef}
      className={`stage ${fullscreen ? 'is-fullscreen' : ''} ${controls ? 'show-controls' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        gesture.current.active = false
        setSeekPreview(null)
      }}
      onDoubleClick={(e) => e.preventDefault()}
    >
      <video
        ref={videoRef}
        className="stage-video"
        style={{ filter: `brightness(${brightness})` }}
        poster={img(title.backdrop || title.poster, 'w780')}
        playsInline
        preload="metadata"
        muted={muted}
        onPlay={() => {
          setPlaying(true)
          setEnded(false)
        }}
        onPause={() => {
          setPlaying(false)
          commitProgress()
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => {
          setWaiting(false)
          setError(null)
        }}
        onCanPlay={() => setWaiting(false)}
        onTimeUpdate={onTimeUpdate}
        onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
        onVolumeChange={() => {
          const video = videoRef.current
          if (!video) return
          setVolume(video.volume)
          setMuted(video.muted)
        }}
        onEnded={() => {
          setPlaying(false)
          setEnded(true)
          commitProgress()
          onEnded()
        }}
        onError={() => {
          if (hlsRef.current) return
          setError(
            playback
              ? 'This file could not be played. It may be unavailable or blocked (CORS) on your network.'
              : 'No source available.',
          )
          setWaiting(false)
        }}
        onClick={(e) => e.preventDefault()}
      />

      {waiting && !error && (
        <div className="stage-spinner" aria-hidden>
          <span />
        </div>
      )}

      {hud && <div className="stage-hud">{hud}</div>}

      {seekPreview != null && (
        <div className="seek-preview">
          <span className="seek-preview-time">{clock(seekPreview)}</span>
          <span className="seek-preview-delta">
            {seekPreview - time >= 0 ? '+' : '-'}
            {clock(Math.abs(seekPreview - time))}
          </span>
        </div>
      )}

      {!playing && !waiting && !error && !ended && (
        <button type="button" className="stage-bigplay" onClick={togglePlay} aria-label="Play">
          <Play size={30} />
        </button>
      )}

      {error && (
        <div className="stage-error">
          <p>{error}</p>
          <div className="stage-error-actions">
            <button
              type="button"
              className="btn btn-small btn-primary"
              onClick={() => {
                setError(null)
                setWaiting(true)
                const video = videoRef.current
                if (video) {
                  void video.load()
                  void video.play().catch(() => undefined)
                }
              }}
            >
              <Refresh size={16} /> Retry
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={onOpenSource}>
              Switch source
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={onBack}>
              Back
            </button>
          </div>
        </div>
      )}

      {ended && nextEpisode && autoNextIn != null && (
        <div className="stage-next">
          <p className="stage-next-label">Up next in {autoNextIn}s</p>
          <p className="stage-next-title">
            S{nextEpisode.season} E{nextEpisode.number} · {nextEpisode.title}
          </p>
          <div className="stage-error-actions">
            <button type="button" className="btn btn-small btn-primary" onClick={onNext}>
              <Play size={14} /> Play now
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setAutoNextIn(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* top chrome */}
      <div className="stage-top">
        <button type="button" className="icon-btn icon-btn-glass" onClick={onBack} aria-label="Back">
          <Back size={22} />
        </button>
        <div className="stage-top-title">
          <span className="stage-top-name">{title.title}</span>
          {episode && (
            <span className="stage-top-ep">
              S{episode.season} E{episode.number} · {episode.title}
            </span>
          )}
        </div>
        <button type="button" className="icon-btn icon-btn-glass" onClick={onOpenDownload} aria-label="Download">
          <DownloadIcon size={20} />
        </button>
      </div>

      {/* bottom chrome */}
      <div className="stage-bottom">
        <div className="stage-badges">
          {offlineLabel ? (
            <span className="stage-badge is-offline">
              <Wifi size={12} /> {offlineLabel}
            </span>
          ) : (
            <span className="stage-badge">{title.certification ?? title.type === 'series' ? 'Series' : 'HD'}</span>
          )}
          {levels.length > 0 && <span className="stage-badge">{displayQuality}</span>}
        </div>

        <div className="stage-scrub">
          <div className="scrub-track">
            <div className="scrub-buffer" style={{ width: `${buffered * 100}%` }} />
            <div className="scrub-played" style={{ width: `${total ? (time / total) * 100 : 0}%` }} />
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(1, total)}
            step={0.1}
            value={Math.min(time, total || 1)}
            aria-label="Seek"
            onChange={(e) => {
              const video = videoRef.current
              if (video) video.currentTime = Number(e.target.value)
              setTime(Number(e.target.value))
            }}
          />
        </div>

        <div className="stage-controls">
          <div className="stage-controls-left">
            <button type="button" className="icon-btn" onClick={() => seekBy(-10)} aria-label="Back 10 seconds">
              <Rewind size={20} />
            </button>
            <button type="button" className="icon-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause size={26} /> : <Play size={26} />}
            </button>
            <button type="button" className="icon-btn" onClick={() => seekBy(10)} aria-label="Forward 10 seconds">
              <Forward size={20} />
            </button>
            <span className="stage-time">
              {clock(time)} <em>/ {clock(total)}</em>
            </span>
          </div>
          <div className="stage-controls-right">
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                const video = videoRef.current
                if (!video) return
                video.muted = !video.muted
                if (!video.muted && video.volume === 0) video.volume = 0.8
              }}
              aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'}
            >
              {muted || volume === 0 ? <VolumeOff size={20} /> : <Volume size={20} />}
            </button>
            {levels.length > 0 && (
              <button type="button" className="icon-btn quality-btn" onClick={() => setQualitySheet(true)} aria-label="Quality">
                {displayQuality}
              </button>
            )}
            {nextEpisode && (
              <button type="button" className="icon-btn" onClick={onNext} aria-label="Next episode">
                <Next size={20} />
              </button>
            )}
            <button type="button" className="icon-btn" onClick={toggleFullscreen} aria-label="Fullscreen">
              {fullscreen ? <Shrink size={20} /> : <Expand size={20} />}
            </button>
          </div>
        </div>
      </div>

      <Sheet open={qualitySheet} onClose={() => setQualitySheet(false)} title="Quality">
        <button
          type="button"
          className="list-row"
          onClick={() => {
            if (hlsRef.current) hlsRef.current.currentLevel = -1
            setQualitySheet(false)
            flash('Auto quality')
          }}
        >
          <span>Auto</span>
          {currentLevel === -1 && <Check size={18} />}
        </button>
        {levels.map((l) => (
          <button
            key={l.index}
            type="button"
            className="list-row"
            onClick={() => {
              if (hlsRef.current) hlsRef.current.currentLevel = l.index
              setQualitySheet(false)
            }}
          >
            <span>
              {l.height ? `${l.height}p` : 'Source'}{' '}
              <em className="muted">{Math.round(l.bitrate / 1000)} kbps</em>
            </span>
            {currentLevel === l.index && <Check size={18} />}
          </button>
        ))}
        <p className="sheet-note">
          {usingOffline ? 'You are playing the downloaded file, so quality is fixed.' : 'Higher qualities need more bandwidth.'}
        </p>
      </Sheet>
    </div>
  )
}
