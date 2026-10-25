import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { img, rating } from '../lib/format'
import { useStore } from '../lib/store'
import type { Title } from '../lib/types'
import { Check, Close, Star } from './Icons'

/* ------------------------------------------------------------------ poster */

export function Poster({
  title,
  path,
  size = 'w300',
  alt,
  className = '',
  rounded = 14,
  eager = false,
}: {
  title: string
  path?: string
  size?: 'w200' | 'w300' | 'w500' | 'w780'
  alt?: string
  className?: string
  rounded?: number
  eager?: boolean
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(path ? 'loading' : 'error')
  const src = img(path, size)
  return (
    <div
      className={`poster ${className} ${state === 'ok' ? 'is-loaded' : ''}`}
      style={{ borderRadius: rounded }}
    >
      {state !== 'error' && src ? (
        <img
          src={src}
          alt={alt ?? title}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
        />
      ) : (
        <div className="poster-fallback" aria-hidden>
          <span>{initials(title)}</span>
        </div>
      )}
      {state === 'loading' && <div className="poster-shimmer" aria-hidden />}
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

/* -------------------------------------------------------------- media card */

export function MediaCard({
  title,
  progress,
  width = 132,
  showYear = true,
  badge,
  fill = false,
}: {
  title: Title
  progress?: number
  width?: number
  showYear?: boolean
  badge?: string
  fill?: boolean
}) {
  return (
    <Link
      to={`/title/${title.id}`}
      className={`media-card ${fill ? 'is-fill' : ''}`}
      style={fill ? undefined : { width }}
      aria-label={`${title.title}${title.year ? ` (${title.year})` : ''}`}
    >
      <div className="media-card-art">
        <Poster title={title.title} path={title.poster} size="w300" />
        {badge && <span className="media-card-badge">{badge}</span>}
        {title.rating ? (
          <span className="media-card-rating">
            <Star size={10} /> {rating(title.rating)}
          </span>
        ) : null}
        {progress != null && progress > 0 ? (
          <span className="media-card-progress">
            <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </span>
        ) : null}
      </div>
      <div className="media-card-title">{title.title}</div>
      <div className="media-card-meta">
        {showYear ? title.year ?? '' : ''}
        {showYear && title.year && title.type === 'series' ? ' · Series' : ''}
        {!showYear ? (title.type === 'series' ? 'Series' : title.runtime ?? '') : ''}
      </div>
    </Link>
  )
}

/* --------------------------------------------------------------------- row */

export function Row({
  heading,
  action,
  children,
  className = '',
}: {
  heading: string
  action?: { label: string; to: string }
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`row ${className}`}>
      <header className="row-head">
        <h2>{heading}</h2>
        {action && (
          <Link to={action.to} className="row-more">
            {action.label}
          </Link>
        )}
      </header>
      <div className="row-scroller">{children}</div>
    </section>
  )
}

/* ------------------------------------------------------------------ badges */

export function RatingPill({ value }: { value?: number }) {
  if (!value) return null
  return (
    <span className="pill pill-rating">
      <Star size={11} /> {rating(value)}
    </span>
  )
}

export function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button type="button" className={`chip ${active ? 'is-active' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------- sheet */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="sheet-layer" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-grab" />
        <header className="sheet-head">
          {title && <h3>{title}</h3>}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Close size={20} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ toasts */

export function Toasts() {
  const { toasts } = useStore()
  if (!toasts.length) return null
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone === 'error' ? 'is-error' : ''}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------- misc */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body?: string
  action?: { label: string; to: string }
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action && (
        <Link to={action.to} className="btn btn-primary">
          {action.label}
        </Link>
      )}
    </div>
  )
}

export function SkeletonRow({ count = 6, width = 132 }: { count?: number; width?: number }) {
  return (
    <div className="row-scroller" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card" style={{ width }}>
          <div className="skeleton skeleton-art" />
          <div className="skeleton skeleton-line" />
        </div>
      ))}
    </div>
  )
}

export function ProgressBar({ value, sub }: { value: number; sub?: string }) {
  return (
    <div className="progress">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
      </div>
      {sub && <span className="progress-sub">{sub}</span>}
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'is-active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="setting-row">
      <span className="setting-copy">
        <span className="setting-label">{label}</span>
        {hint && <span className="setting-hint">{hint}</span>}
      </span>
      <span className={`switch ${checked ? 'is-on' : ''}`}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch-knob">{checked && <Check size={12} />}</span>
      </span>
    </label>
  )
}

/** Reusable horizontal scroll snapping helper for desktop mouse wheels. */
export function useHorizontalWheel<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0) return
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0
      const atEnd = el.scrollLeft >= max - 1 && e.deltaY > 0
      if (atStart || atEnd) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  return ref
}
