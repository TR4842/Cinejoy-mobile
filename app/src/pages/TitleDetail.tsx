import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Back,
  Bookmark,
  BookmarkFilled,
  Check,
  Download as DownloadIcon,
  Layers,
  Play,
  Star,
} from '../components/Icons'
import { MediaCard, Poster, Row, Sheet } from '../components/ui'
import { similar } from '../lib/api'
import { clock, img, rating, year } from '../lib/format'
import { openExternal } from '../lib/platform'
import { useStore } from '../lib/store'
import type { Episode, Title } from '../lib/types'

export default function TitleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, inWatchlist, toggleWatchlist, resumeFor, downloads, startDownload, settings } = useStore()
  const title = useMemo(() => items.find((t) => t.id === id), [items, id])
  const resume = useMemo(() => (title ? resumeFor(title.id) : undefined), [title, resumeFor])
  const [season, setSeason] = useState<number | null>(null)
  const [downloadSheet, setDownloadSheet] = useState(false)

  if (!title) {
    return (
      <div className="page page-plain">
        <button type="button" className="icon-btn page-back" onClick={() => navigate(-1)} aria-label="Back">
          <Back size={22} />
        </button>
        <div className="empty">
          <h3>Title unavailable</h3>
          <p>It may still be loading from the catalog.</p>
          <Link to="/" className="btn btn-primary">
            Back home
          </Link>
        </div>
      </div>
    )
  }

  const isSeries = title.type === 'series'
  const seasons = title.seasons ?? []
  const activeSeason = seasons.find((s) => s.number === (season ?? resume?.season ?? seasons[0]?.number)) ?? seasons[0]
  const playTarget = (() => {
    if (!isSeries) return `/watch/${title.id}${resume ? `?t=${Math.floor(resume.position)}` : ''}`
    if (resume?.season != null) return `/watch/${title.id}/${resume.season}/${resume.episode}`
    const first = seasons[0]?.episodes[0]
    return first ? `/watch/${title.id}/${first.season}/${first.number}` : `/watch/${title.id}`
  })()
  const listHas = inWatchlist(title.id)
  const savedCount = downloads.filter((d) => d.titleId === title.id && d.status === 'complete').length
  const playableSources = (isSeries ? seasons[0]?.episodes[0]?.sources : title.sources) ?? []

  function downloadEpisode(ep?: Episode) {
    const list = ep?.sources ?? playableSources
    const mp4 = list.filter((s) => s.kind === 'mp4')
    const best = mp4.sort((a, b) => Number(b.quality?.replace(/\D/g, '') ?? 0) - Number(a.quality?.replace(/\D/g, '') ?? 0))[0]
    if (!best) return
    startDownload({ title: title!, episode: ep, source: best })
  }

  return (
    <div className="page page-detail">
      <div className="detail-hero">
        <img className="detail-backdrop" src={img(title.backdrop || title.poster, 'w780')} alt="" aria-hidden />
        <div className="detail-hero-fade" />
        <button type="button" className="icon-btn icon-btn-glass detail-back" onClick={() => navigate(-1)} aria-label="Back">
          <Back size={22} />
        </button>
      </div>

      <div className="detail-head">
        <div className="detail-poster">
          <Poster title={title.title} path={title.poster} size="w500" rounded={16} eager />
        </div>
        <div className="detail-title-block">
          <h1>{title.title}</h1>
          <div className="detail-meta">
            {title.rating ? (
              <span className="pill pill-rating">
                <Star size={11} /> {rating(title.rating)}
              </span>
            ) : null}
            <span>{year(title)}</span>
            {title.certification && <span>{title.certification}</span>}
            {isSeries ? (
              <span>{title.seasonCount ? `${title.seasonCount} seasons` : `${seasons.length} seasons`}</span>
            ) : (
              title.runtime && <span>{title.runtime}</span>
            )}
            {title.language && <span>{title.language}</span>}
          </div>
          <div className="detail-genres">{title.genres.join(' · ')}</div>
          {title.provider && <div className="detail-provider">On {title.provider}</div>}
        </div>
      </div>

      <div className="detail-actions">
        <Link to={playTarget} className="btn btn-primary btn-block">
          <Play size={16} />
          {resume ? `Resume ${clock(resume.position)}` : isSeries ? 'Play episode 1' : 'Play'}
        </Link>
        <button type="button" className="btn btn-ghost btn-square" onClick={() => setDownloadSheet(true)} aria-label="Download">
          <DownloadIcon size={20} />
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-square ${listHas ? 'is-on' : ''}`}
          onClick={() => toggleWatchlist(title.id)}
          aria-label="My list"
        >
          {listHas ? <BookmarkFilled size={20} /> : <Bookmark size={20} />}
        </button>
      </div>

      {savedCount > 0 && (
        <div className="notice is-ok">
          <Check size={16} /> {savedCount} file{savedCount > 1 ? 's' : ''} available offline ·{' '}
          <Link to="/downloads">open downloads</Link>
        </div>
      )}

      {title.overview ? (
        <p className="detail-overview">{title.overview}</p>
      ) : (
        <p className="detail-overview is-muted">
          No synopsis in the bundled sample. Turn on the live catalog in Settings to pull the full page.
        </p>
      )}

      <div className="detail-facts">
        {title.director && <Fact label="Director" value={title.director} />}
        {title.creators?.length ? <Fact label="Created by" value={title.creators.join(', ')} /> : null}
        {title.status && <Fact label="Status" value={title.status} />}
        {title.episodeCount ? <Fact label="Episodes" value={String(title.episodeCount)} /> : null}
        {title.votes ? <Fact label="Votes" value={title.votes.toLocaleString()} /> : null}
        {title.pageUrl && (
          <Fact
            label="Source page"
            value={
              <button type="button" className="link-btn" onClick={() => void openExternal(title.pageUrl!)}>
                cinejoy.pk
              </button>
            }
          />
        )}
      </div>

      {title.trailerKey && (
        <button
          type="button"
          className="trailer-card"
          onClick={() => void openExternal(`https://www.youtube.com/watch?v=${title.trailerKey}`)}
        >
          <img src={`https://img.youtube.com/vi/${title.trailerKey}/mqdefault.jpg`} alt="" loading="lazy" />
          <span className="trailer-play">
            <Play size={18} />
          </span>
          <span className="trailer-label">Official trailer</span>
        </button>
      )}

      {title.cast && title.cast.length > 0 && (
        <Row heading="Cast">
          {title.cast.map((c) => (
            <div key={c.name} className="cast-card">
              <div className="cast-photo">
                {c.photo ? <img src={img(c.photo, 'w200')} alt={c.name} loading="lazy" /> : <span>{c.name.slice(0, 1)}</span>}
              </div>
              <span className="cast-name">{c.name}</span>
              {c.role && <span className="cast-role">{c.role}</span>}
            </div>
          ))}
        </Row>
      )}

      {isSeries && seasons.length > 0 && (
        <section className="row">
          <header className="row-head">
            <h2>Episodes</h2>
            {seasons.length > 1 && (
              <select
                className="season-select"
                value={activeSeason?.number ?? 1}
                onChange={(e) => setSeason(Number(e.target.value))}
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
            {activeSeason?.episodes.map((e) => {
              const saved = downloads.some((d) => d.mediaId === e.id && d.status === 'complete')
              const isResume = resume?.mediaId === e.id
              return (
                <div key={e.id} className="episode-row">
                  <Link to={`/watch/${title.id}/${e.season}/${e.number}`} className="episode-row-link">
                    <div className="episode-thumb">
                      {e.still ? <img src={img(e.still, 'w300')} alt="" loading="lazy" /> : <div className="episode-thumb-fallback">{e.number}</div>}
                      <span className="episode-thumb-play">
                        <Play size={13} />
                      </span>
                    </div>
                    <div className="episode-copy">
                      <div className="episode-title">
                        <span className="episode-num">E{e.number}</span> {e.title}
                        {isResume && <span className="episode-tag">Resume</span>}
                        {saved && <span className="episode-tag is-offline">Offline</span>}
                      </div>
                      <div className="episode-meta">{e.runtime ?? ''}</div>
                      {e.overview && <p className="episode-overview">{e.overview}</p>}
                    </div>
                  </Link>
                  <button type="button" className="icon-btn" onClick={() => downloadEpisode(e)} aria-label={`Download episode ${e.number}`}>
                    <DownloadIcon size={18} />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {title.collection && title.collection.length > 0 && (
        <Row heading="Part of the collection">
          {title.collection.map((c) => (
            <MediaCard
              key={c.id}
              title={{ id: c.id, title: c.title, year: c.year, type: 'movie', genres: [], poster: c.poster }}
              width={110}
            />
          ))}
        </Row>
      )}

      <Row heading="More like this">
        {similar(items, title, 14).map((t) => (
          <MediaCard key={t.id} title={t} width={124} />
        ))}
      </Row>

      <Sheet open={downloadSheet} onClose={() => setDownloadSheet(false)} title={`Download “${title.title}”`}>
        <p className="sheet-note">
          {settings.wifiOnlyDownloads ? 'Wi-Fi only is on — downloads wait for an unmetered connection.' : 'Saved inside the app for offline playback.'}
        </p>
        {!isSeries &&
          playableSources.map((s) => {
            const existing = downloads.find((d) => d.mediaId === title.id && d.sourceId === s.id)
            return (
              <div key={s.id} className="source-row">
                <div className="source-main">
                  <span className="source-label">{s.kind === 'hls' ? 'Adaptive stream' : s.quality ?? s.label}</span>
                  <span className="source-kind">{s.kind === 'hls' ? 'Streaming only' : 'MP4 file'}</span>
                </div>
                {s.kind === 'hls' ? (
                  <span className="source-tag">stream</span>
                ) : existing?.status === 'complete' ? (
                  <span className="source-done">
                    <Check size={16} /> Saved
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-small btn-primary"
                    onClick={() => {
                      startDownload({ title, source: s })
                      setDownloadSheet(false)
                      navigate('/downloads')
                    }}
                  >
                    Download
                  </button>
                )}
              </div>
            )
          })}
        {isSeries && activeSeason && (
          <>
            <p className="sheet-note">Season {activeSeason.number}</p>
            {activeSeason.episodes.slice(0, 12).map((e) => (
              <div key={e.id} className="source-row">
                <div className="source-main">
                  <span className="source-label">
                    E{e.number} · {e.title}
                  </span>
                  <span className="source-kind">{e.runtime}</span>
                </div>
                <button type="button" className="btn btn-small btn-ghost" onClick={() => downloadEpisode(e)}>
                  <DownloadIcon size={16} />
                </button>
              </div>
            ))}
          </>
        )}
        <Link to="/downloads" className="btn btn-ghost btn-block" onClick={() => setDownloadSheet(false)}>
          <Layers size={16} /> Manage downloads
        </Link>
      </Sheet>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="fact">
      <span className="fact-label">{label}</span>
      <span className="fact-value">{value}</span>
    </div>
  )
}
