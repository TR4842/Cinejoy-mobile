import React, { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Back } from '../components/Icons'
import { MediaCard } from '../components/ui'
import { latest, trending } from '../lib/api'
import { useStore } from '../lib/store'

const TITLES: Record<string, string> = {
  movie: 'Movies',
  series: 'Series',
  new: 'New releases',
  top: 'Critically acclaimed',
}

export default function Browse() {
  const { kind = 'movie' } = useParams()
  const navigate = useNavigate()
  const { items } = useStore()

  const list = useMemo(() => {
    const sorted = trending(items)
    switch (kind) {
      case 'series':
        return sorted.filter((t) => t.type === 'series')
      case 'new':
        return latest(items)
      case 'top':
        return sorted.filter((t) => (t.rating ?? 0) >= 7)
      default:
        return sorted.filter((t) => t.type === 'movie')
    }
  }, [items, kind])

  return (
    <div className="page page-browse">
      <header className="page-head page-head-row">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">
          <Back size={22} />
        </button>
        <h1>{TITLES[kind] ?? 'Browse'}</h1>
        <span className="page-head-meta">{list.length}</span>
      </header>
      <div className="grid grid-wide">
        {list.map((t) => (
          <MediaCard key={t.id} title={t} fill />
        ))}
      </div>
    </div>
  )
}
