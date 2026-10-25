import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Clock, Play, Trash } from '../components/Icons'
import { EmptyState, Poster, Segmented } from '../components/ui'
import { clock, episodeCode } from '../lib/format'
import { useStore } from '../lib/store'

export default function Library() {
  const { items, watchlist, history, removeHistory, clearHistory, toggleWatchlist, downloads } = useStore()
  const [tab, setTab] = useState<'list' | 'history' | 'offline'>('list')

  const listed = useMemo(
    () => watchlist.map((id) => items.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t),
    [watchlist, items],
  )

  return (
    <div className="page page-library">
      <header className="page-head">
        <h1>My Cinejoy</h1>
        <span className="page-head-meta">
          {listed.length} saved · {history.length} watched
        </span>
      </header>

      <div className="library-tabs">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'list', label: 'My list' },
            { value: 'history', label: 'History' },
            { value: 'offline', label: 'Offline' },
          ]}
        />
      </div>

      {tab === 'list' &&
        (listed.length === 0 ? (
          <EmptyState
            icon={<Bookmark size={28} />}
            title="Your list is empty"
            body="Tap the bookmark on any title to keep it here for later."
            action={{ label: 'Find something to watch', to: '/search' }}
          />
        ) : (
          <div className="library-list">
            {listed.map((t) => (
              <div key={t.id} className="library-row">
                <Link to={`/title/${t.id}`} className="library-row-link">
                  <div className="library-poster">
                    <Poster title={t.title} path={t.poster} size="w200" rounded={10} />
                  </div>
                  <div className="library-copy">
                    <span className="library-title">{t.title}</span>
                    <span className="library-meta">
                      {t.year} · {t.type === 'series' ? 'Series' : t.runtime ?? 'Movie'}
                      {t.rating ? ` · ★ ${t.rating.toFixed(1)}` : ''}
                    </span>
                    <span className="library-genres">{t.genres.slice(0, 3).join(' · ')}</span>
                  </div>
                </Link>
                <button type="button" className="icon-btn" onClick={() => toggleWatchlist(t.id)} aria-label="Remove from list">
                  <Trash size={17} />
                </button>
              </div>
            ))}
          </div>
        ))}

      {tab === 'history' &&
        (history.length === 0 ? (
          <EmptyState
            icon={<Clock size={28} />}
            title="No watch history yet"
            body="Everything you start watching shows up here with its resume point."
            action={{ label: 'Start watching', to: '/' }}
          />
        ) : (
          <>
            <div className="library-list">
              {history.map((h) => {
                const title = items.find((t) => t.id === h.titleId)
                const progress = h.duration ? h.position / h.duration : 0
                const to =
                  h.type === 'series' && h.season != null
                    ? `/watch/${h.titleId}/${h.season}/${h.episode}`
                    : `/watch/${h.titleId}?t=${Math.floor(h.position)}`
                return (
                  <div key={h.mediaId} className="library-row">
                    <Link to={to} className="library-row-link">
                      <div className="library-poster">
                        <Poster title={h.titleName} path={h.poster} size="w200" rounded={10} />
                        <span className="library-play">
                          <Play size={14} />
                        </span>
                      </div>
                      <div className="library-copy">
                        <span className="library-title">
                          {h.titleName}
                          {h.season != null ? ` · ${episodeCode(h.season, h.episode)}` : ''}
                        </span>
                        <span className="library-meta">
                          {clock(h.position)} / {clock(h.duration)}
                        </span>
                        <span className="library-progress">
                          <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
                        </span>
                      </div>
                    </Link>
                    <button type="button" className="icon-btn" onClick={() => removeHistory(h.mediaId)} aria-label="Remove from history">
                      <Trash size={17} />
                    </button>
                    {!title && <span className="library-tag">not in sample</span>}
                  </div>
                )
              })}
            </div>
            <button type="button" className="btn btn-ghost btn-block" onClick={clearHistory}>
              Clear watch history
            </button>
          </>
        ))}

      {tab === 'offline' &&
        (downloads.length === 0 ? (
          <EmptyState
            icon={<Play size={28} />}
            title="No offline titles"
            body="Download a movie or episode to watch it without a connection."
            action={{ label: 'Go to downloads', to: '/downloads' }}
          />
        ) : (
          <div className="library-list">
            {downloads.map((d) => (
              <Link
                key={d.key}
                to={d.type === 'series' && d.season != null ? `/watch/${d.titleId}/${d.season}/${d.episode}` : `/watch/${d.titleId}`}
                className="library-row-link"
              >
                <div className="library-poster">
                  <Poster title={d.titleName} path={d.poster} size="w200" rounded={10} />
                </div>
                <div className="library-copy">
                  <span className="library-title">{d.titleName}</span>
                  <span className="library-meta">
                    {d.subtitle ?? d.sourceLabel} · {d.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ))}
    </div>
  )
}
