import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  Download as DownloadIcon,
  Pause,
  Play,
  Refresh,
  Trash,
  Wifi,
} from '../components/Icons'
import { EmptyState, Poster, ProgressBar } from '../components/ui'
import { idbGet } from '../lib/db'
import { bytes } from '../lib/format'
import { saveFile } from '../lib/platform'
import { useStore } from '../lib/store'
import type { DownloadItem } from '../lib/types'

export default function Downloads() {
  const {
    downloads,
    pauseDownload,
    resumeDownload,
    retryDownload,
    removeDownload,
    deleteAllDownloads,
    storage,
    toast,
  } = useStore()
  const [saving, setSaving] = useState<string | null>(null)

  const active = downloads.filter((d) => ['queued', 'downloading', 'paused', 'failed'].includes(d.status))
  const completed = downloads.filter((d) => d.status === 'complete')
  const totalBytes = completed.reduce((sum, d) => sum + (d.total || d.downloaded || 0), 0)

  function watchLink(d: DownloadItem): string {
    if (d.type === 'series' && d.season != null && d.episode != null) {
      return `/watch/${d.titleId}/${d.season}/${d.episode}`
    }
    return `/watch/${d.titleId}`
  }

  async function exportFile(d: DownloadItem) {
    setSaving(d.key)
    try {
      const blob = await idbGet<Blob>('blobs', d.key)
      if (!blob) {
        toast('The saved file is missing. Re-download it.', 'error')
        return
      }
      const name = `${d.titleName}${d.subtitle ? ` ${d.subtitle.replace(/[·]/g, '-')}` : ''} ${d.quality ?? ''}`
        .replace(/[^\w\s.-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      const res = await saveFile(blob, `${name}.mp4`)
      if (res.ok) toast(`Saved to ${res.where}`)
      else toast(res.message ?? 'Could not save the file', 'error')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="page page-downloads">
      <header className="page-head">
        <h1>Downloads</h1>
        <span className="page-head-meta">
          {completed.length} saved · {bytes(totalBytes)}
        </span>
      </header>

      {downloads.length === 0 ? (
        <EmptyState
          icon={<DownloadIcon size={30} />}
          title="Nothing downloaded yet"
          body="Tap the download icon on any movie or episode to keep it on this device and watch without a connection."
          action={{ label: 'Browse movies', to: '/browse/movie' }}
        />
      ) : (
        <>
          {active.length > 0 && (
            <section className="dl-section">
              <h2 className="dl-heading">In progress</h2>
              {active.map((d) => (
                <div key={d.key} className="dl-card">
                  <div className="dl-poster">
                    <Poster title={d.titleName} path={d.poster} size="w200" rounded={10} />
                  </div>
                  <div className="dl-main">
                    <div className="dl-title">{d.titleName}</div>
                    {d.subtitle && <div className="dl-sub">{d.subtitle}</div>}
                    <div className="dl-meta">
                      {d.quality ?? d.sourceLabel}
                      {d.total ? ` · ${bytes(d.total)}` : ''}
                      {d.status === 'downloading' && d.total ? ` · ${Math.round((d.downloaded / d.total) * 100)}%` : ''}
                    </div>
                    {d.status === 'downloading' && (
                      <ProgressBar
                        value={d.total ? d.downloaded / d.total : 0}
                        sub={`${bytes(d.downloaded)}${d.total ? ` / ${bytes(d.total)}` : ''}`}
                      />
                    )}
                    {d.status === 'paused' && <p className="dl-note">Paused</p>}
                    {d.status === 'queued' && <p className="dl-note">Waiting in queue…</p>}
                    {d.status === 'failed' && (
                      <p className="dl-note is-error">
                        {d.error ?? 'Download failed'}
                      </p>
                    )}
                    <div className="dl-actions">
                      {d.status === 'downloading' && (
                        <button type="button" className="btn btn-small btn-ghost" onClick={() => pauseDownload(d.key)}>
                          <Pause size={14} /> Pause
                        </button>
                      )}
                      {d.status === 'paused' && (
                        <button type="button" className="btn btn-small btn-primary" onClick={() => resumeDownload(d.key)}>
                          <Play size={14} /> Resume
                        </button>
                      )}
                      {d.status === 'failed' && (
                        <button type="button" className="btn btn-small btn-primary" onClick={() => retryDownload(d.key)}>
                          <Refresh size={14} /> Retry
                        </button>
                      )}
                      <button type="button" className="btn btn-small btn-ghost" onClick={() => removeDownload(d.key)}>
                        <Trash size={14} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {completed.length > 0 && (
            <section className="dl-section">
              <div className="dl-heading-row">
                <h2 className="dl-heading">Ready offline</h2>
                <button type="button" className="link-btn" onClick={deleteAllDownloads}>
                  Delete all
                </button>
              </div>
              {completed.map((d) => (
                <div key={d.key} className="dl-card">
                  <Link to={watchLink(d)} className="dl-poster">
                    <Poster title={d.titleName} path={d.poster} size="w200" rounded={10} />
                    <span className="dl-poster-play">
                      <Play size={16} />
                    </span>
                  </Link>
                  <div className="dl-main">
                    <div className="dl-title">{d.titleName}</div>
                    {d.subtitle && <div className="dl-sub">{d.subtitle}</div>}
                    <div className="dl-meta">
                      <Check size={12} /> {bytes(d.total || d.downloaded)} · {d.quality ?? d.sourceLabel} · offline ready
                    </div>
                    <div className="dl-actions">
                      <Link to={watchLink(d)} className="btn btn-small btn-primary">
                        <Play size={14} /> Play
                      </Link>
                      <button
                        type="button"
                        className="btn btn-small btn-ghost"
                        disabled={saving === d.key}
                        onClick={() => void exportFile(d)}
                      >
                        {saving === d.key ? 'Saving…' : 'Save to device'}
                      </button>
                      <button type="button" className="icon-btn icon-btn-danger" onClick={() => removeDownload(d.key)} aria-label="Delete">
                        <Trash size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="dl-section dl-storage">
            <h2 className="dl-heading">Storage</h2>
            <div className="storage-bar">
              <span style={{ width: `${storage.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 4}%` }} />
            </div>
            <p className="dl-note">
              {bytes(storage.usage)} used of {bytes(storage.quota)} available to the app
            </p>
            <p className="dl-note">
              Playback position is saved every few seconds while you watch, and downloads play with no data.
            </p>
          </section>

          <div className="dl-tip">
            <Wifi size={16} />
            <span>Downloads stay inside the app. Use “Save to device” to copy a file into your Movies folder.</span>
          </div>
          <p className="dl-note dl-clock-note">Resume points are stored per episode — tap Play to pick up where you stopped.</p>
        </>
      )}
    </div>
  )
}
