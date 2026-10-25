import React, { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bookmark, BookmarkFilled, Play, Refresh, Search as SearchIcon, Star } from '../components/Icons'
import { MediaCard, Poster, Row, SkeletonRow } from '../components/ui'
import { latest, providers, trending } from '../lib/api'
import { clock, img, rating, year } from '../lib/format'
import { useStore } from '../lib/store'
import type { Title } from '../lib/types'

export default function Home() {
  const { items, loading, refreshFeed, feed, history, watchlist, inWatchlist, toggleWatchlist } = useStore()
  const navigate = useNavigate()

  const top = useMemo(() => trending(items), [items])
  const hero = useMemo(() => top.find((t) => t.backdrop) ?? top[0], [top])
  const movies = useMemo(() => top.filter((t) => t.type === 'movie'), [top])
  const series = useMemo(() => top.filter((t) => t.type === 'series'), [top])
  const fresh = useMemo(() => latest(items).slice(0, 14), [items])
  const providerList = useMemo(() => providers(items).slice(0, 12), [items])

  const continueWatching = useMemo(() => {
    return history
      .filter((h) => h.duration - h.position > 30 && h.position > 15)
      .slice(0, 10)
      .map((h) => ({ entry: h, title: items.find((t) => t.id === h.titleId) }))
      .filter((x): x is { entry: typeof history[number]; title: Title } => !!x.title)
  }, [history, items])

  const myList = useMemo(
    () => watchlist.map((id) => items.find((t) => t.id === id)).filter((t): t is Title => !!t),
    [watchlist, items],
  )

  if (loading && !items.length) {
    return (
      <div className="page">
        <div className="skeleton skeleton-hero" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="row">
            <div className="skeleton skeleton-line skeleton-line-title" />
            <SkeletonRow />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="page page-home">
      <header className="home-head">
        <Link to="/" className="wordmark" aria-label="Cinejoy home">
          CINE<span>JOY</span>
        </Link>
        <div className="home-head-actions">
          <Link to="/search" className="icon-btn" aria-label="Search">
            <SearchIcon size={21} />
          </Link>
        </div>
      </header>

      {feed?.demo && (
        <button type="button" className="demo-banner" onClick={() => void refreshFeed()}>
          <span>
            <strong>Sample catalog</strong> · {feed.items.length} titles bundled for offline use
          </span>
          <Refresh size={15} />
        </button>
      )}

      {hero && <Hero title={hero} onPlay={() => navigate(`/watch/${hero.id}`)} inList={inWatchlist(hero.id)} onList={() => toggleWatchlist(hero.id)} />}

      {continueWatching.length > 0 && (
        <section className="row">
          <header className="row-head">
            <h2>Continue watching</h2>
            <Link to="/library" className="row-more">
              My list
            </Link>
          </header>
          <div className="row-scroller">
            {continueWatching.map(({ entry, title }) => {
              const progress = entry.duration ? entry.position / entry.duration : 0
              const to =
                entry.type === 'series' && entry.season != null
                  ? `/watch/${title.id}/${entry.season}/${entry.episode}`
                  : `/watch/${title.id}?t=${Math.floor(entry.position)}`
              return (
                <Link key={entry.mediaId} to={to} className="continue-card" style={{ width: 210 }}>
                  <div className="continue-art">
                    <Poster title={title.title} path={title.backdrop || title.poster} size="w300" rounded={12} />
                    <span className="continue-play">
                      <Play size={18} />
                    </span>
                    <span className="continue-progress">
                      <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
                    </span>
                  </div>
                  <div className="continue-copy">
                    <span className="continue-title">{title.title}</span>
                    <span className="continue-meta">
                      {entry.episode != null ? `S${entry.season} E${entry.episode} · ` : ''}
                      {clock(entry.position)} / {clock(entry.duration)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {myList.length > 0 && (
        <Row heading="My list" action={{ label: 'Manage', to: '/library' }}>
          {myList.slice(0, 12).map((t) => (
            <MediaCard key={t.id} title={t} width={124} />
          ))}
        </Row>
      )}

      {providerList.length > 0 && (
        <section className="row">
          <header className="row-head">
            <h2>Browse by provider</h2>
          </header>
          <div className="row-scroller provider-strip">
            {providerList.map((p) => (
              <Link key={p.name} to={`/search?q=${encodeURIComponent(p.name)}`} className="provider-chip">
                <span className="provider-dot" />
                <span>{p.name}</span>
                <em>{p.count}</em>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Row heading="Trending movies" action={{ label: 'See all', to: '/browse/movie' }}>
        {movies.slice(0, 16).map((t) => (
          <MediaCard key={t.id} title={t} width={132} />
        ))}
      </Row>

      <Row heading="Trending series" action={{ label: 'See all', to: '/browse/series' }}>
        {series.slice(0, 16).map((t) => (
          <MediaCard key={t.id} title={t} width={132} />
        ))}
      </Row>

      <Row heading="New releases" action={{ label: 'See all', to: '/browse/new' }}>
        {fresh.map((t) => (
          <MediaCard key={t.id} title={t} width={112} showYear={false} />
        ))}
      </Row>

      <Row heading="Critically acclaimed" action={{ label: 'See all', to: '/browse/top' }}>
        {top
          .filter((t) => (t.rating ?? 0) >= 7)
          .slice(0, 16)
          .map((t) => (
            <MediaCard key={t.id} title={t} width={124} />
          ))}
      </Row>

      <footer className="home-foot">
        <p>
          Cinejoy for Android · catalog preview
          <br />
          Metadata &amp; artwork by TMDB · streams are bundled samples
        </p>
        <Link to="/settings" className="home-foot-link">
          About &amp; settings
        </Link>
      </footer>
    </div>
  )
}

function Hero({
  title,
  onPlay,
  inList,
  onList,
}: {
  title: Title
  onPlay: () => void
  inList: boolean
  onList: () => void
}) {
  return (
    <section className="hero">
      <div className="hero-art">
        <img src={img(title.backdrop || title.poster, 'w780')} alt="" aria-hidden />
        <div className="hero-fade" />
      </div>
      <div className="hero-content">
        <span className="hero-kicker">
          <Star size={11} /> {rating(title.rating) || 'New'} {year(title) ? `· ${year(title)}` : ''}
        </span>
        <h1 className="hero-title">{title.title}</h1>
        <p className="hero-meta">{[title.certification, title.runtime, title.genres.slice(0, 2).join(' · ')].filter(Boolean).join(' · ')}</p>
        {title.overview && <p className="hero-overview">{title.overview}</p>}
        <div className="hero-actions">
          <button type="button" className="btn btn-primary" onClick={onPlay}>
            <Play size={16} /> Play
          </button>
          <button type="button" className={`btn btn-glass ${inList ? 'is-on' : ''}`} onClick={onList}>
            {inList ? <BookmarkFilled size={16} /> : <Bookmark size={16} />} My list
          </button>
          <Link to={`/title/${title.id}`} className="btn btn-glass">
            Details
          </Link>
        </div>
      </div>
    </section>
  )
}
