import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Back, Close, Search as SearchIcon } from '../components/Icons'
import { MediaCard } from '../components/ui'
import { allGenres, search, trending } from '../lib/api'
import { useStore } from '../lib/store'
import type { Title } from '../lib/types'

const RECENT_KEY = 'cinejoy.recent-searches.v1'
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'movie', label: 'Movies' },
  { key: 'series', label: 'Series' },
] as const

export default function SearchPage() {
  const { items } = useStore()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [filter, setFilter] = useState<'all' | 'movie' | 'series'>('all')
  const [genre, setGenre] = useState<string | null>(null)
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      return []
    }
  })
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const q = params.get('q')
    if (q != null) setQuery(q)
  }, [params])

  useEffect(() => {
    if (!query) inputRef.current?.focus()
  }, [])

  const results = useMemo(() => {
    let out: Title[] = query.trim() ? search(items, query) : trending(items)
    if (filter !== 'all') out = out.filter((t) => t.type === filter)
    if (genre) out = out.filter((t) => t.genres.includes(genre))
    if (!query.trim() && !genre) out = out.slice(0, 18)
    return out
  }, [items, query, filter, genre])

  const genres = useMemo(() => allGenres(items), [items])

  function commit(value: string) {
    const q = value.trim()
    setQuery(value)
    setParams(q ? { q } : {}, { replace: true })
    if (q.length > 1) {
      const next = [q, ...recent.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 8)
      setRecent(next)
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
    }
  }

  function clearRecent() {
    setRecent([])
    try {
      localStorage.removeItem(RECENT_KEY)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="page page-search">
      <header className="search-head">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">
          <Back size={22} />
        </button>
        <div className="search-input">
          <SearchIcon size={18} />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            placeholder="Titles, people, genres"
            value={query}
            onChange={(e) => commit(e.target.value)}
            aria-label="Search Cinejoy"
          />
          {query && (
            <button type="button" className="icon-btn icon-btn-tiny" onClick={() => commit('')} aria-label="Clear">
              <Close size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="filter-row">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`chip ${filter === f.key ? 'is-active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        {genre && (
          <button type="button" className="chip is-active" onClick={() => setGenre(null)}>
            {genre} <Close size={12} />
          </button>
        )}
      </div>

      {!query && !genre && (
        <>
          {recent.length > 0 && (
            <section className="row">
              <header className="row-head">
                <h2>Recent searches</h2>
                <button type="button" className="row-more" onClick={clearRecent}>
                  Clear
                </button>
              </header>
              <div className="chip-wrap">
                {recent.map((r) => (
                  <button key={r} type="button" className="chip" onClick={() => commit(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="row">
            <header className="row-head">
              <h2>Genres</h2>
            </header>
            <div className="chip-wrap">
              {genres.map((g) => (
                <button key={g} type="button" className="chip" onClick={() => setGenre(g)}>
                  {g}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="row">
        <header className="row-head">
          <h2>
            {query
              ? `${results.length} result${results.length === 1 ? '' : 's'} for “${query}”`
              : genre
                ? `${genre} titles`
                : 'Popular now'}
          </h2>
        </header>
        {results.length === 0 ? (
          <div className="empty empty-inline">
            <h3>Nothing found</h3>
            <p>Try a different spelling, or browse by genre.</p>
          </div>
        ) : (
          <div className="grid">
            {results.map((t) => (
              <MediaCard key={t.id} title={t} fill />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
