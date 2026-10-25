import React, { useEffect, useState } from 'react'
import { Check, Download as DownloadIcon, Info, Refresh, Trash, Wifi } from '../components/Icons'
import { Toggle } from '../components/ui'
import { idbClear, storageEstimate } from '../lib/db'
import { bytes } from '../lib/format'
import { exitApp, isNative, openExternal } from '../lib/platform'
import { useStore } from '../lib/store'
import type { Settings as SettingsShape } from '../lib/types'

export const APP_VERSION = '1.0.0'
const REPO_URL = 'https://github.com/TR4842/Cinejoy-mobile'
const QUALITIES: SettingsShape['defaultQuality'][] = ['auto', '1080p', '720p', '480p']

interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function SettingsPage() {
  const { settings, updateSettings, refreshFeed, feed, loading, downloads, deleteAllDownloads, storage, toast } = useStore()
  const [apiBase, setApiBase] = useState(settings.apiBase)
  const [installEvent, setInstallEvent] = useState<InstallPrompt | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as InstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function wipe() {
    await Promise.all([
      idbClear('blobs').catch(() => undefined),
      idbClear('downloads').catch(() => undefined),
      idbClear('history').catch(() => undefined),
      idbClear('watchlist').catch(() => undefined),
    ])
    try {
      localStorage.clear()
    } catch {
      /* ignore */
    }
    toast('App data cleared — reloading')
    setTimeout(() => window.location.reload(), 700)
  }

  return (
    <div className="page page-settings">
      <header className="page-head">
        <h1>Settings</h1>
      </header>

      <section className="card account-card">
        <div className="avatar">CJ</div>
        <div className="account-copy">
          <strong>{isNative() ? 'Cinejoy for Android' : 'Cinejoy'}</strong>
          <span>
            Version {APP_VERSION} · {isNative() ? 'native build' : 'web build'}
          </span>
        </div>
        {installEvent && !isNative() && (
          <button
            type="button"
            className="btn btn-small btn-primary"
            onClick={async () => {
              await installEvent.prompt()
              const choice = await installEvent.userChoice
              if (choice.outcome === 'accepted') setInstallEvent(null)
            }}
          >
            Install
          </button>
        )}
      </section>

      <section className="settings-group">
        <h2>Catalog</h2>
        <div className="catalog-status">
          <span className={`status-dot ${feed?.demo ? 'is-demo' : 'is-live'}`} />
          <div>
            <strong>{feed?.demo ? 'Bundled sample catalog' : 'Live catalog'}</strong>
            <span>
              {feed ? `${feed.items.length} titles · ${feed.origin}` : 'Loading…'}
              {feed ? ` · fetched ${new Date(feed.fetchedAt).toLocaleTimeString()}` : ''}
            </span>
          </div>
          <button type="button" className="icon-btn" onClick={() => void refreshFeed()} aria-label="Refresh" disabled={loading}>
            <Refresh size={18} />
          </button>
        </div>
        <Toggle
          checked={settings.useLiveFeed}
          onChange={(v) => updateSettings({ useLiveFeed: v })}
          label="Use live cinejoy.pk feed"
          hint="Talks to the companion scraper API. Falls back to the bundled catalog when it is unreachable."
        />
        <label className="setting-row">
          <span className="setting-copy">
            <span className="setting-label">API base URL</span>
            <span className="setting-hint">Leave blank to use this app's origin (e.g. https://api.example.com)</span>
          </span>
        </label>
        <div className="inline-form">
          <input
            className="text-input"
            value={apiBase}
            placeholder="https://cinejoy-api.example.com"
            onChange={(e) => setApiBase(e.target.value)}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="btn btn-small btn-primary"
            onClick={() => {
              updateSettings({ apiBase: apiBase.trim() })
              toast('API base saved')
              setTimeout(() => void refreshFeed(), 100)
            }}
          >
            Save
          </button>
        </div>
      </section>

      <section className="settings-group">
        <h2>Playback</h2>
        <Toggle
          checked={settings.autoplayNext}
          onChange={(v) => updateSettings({ autoplayNext: v })}
          label="Autoplay next episode"
          hint="Starts the next episode when the current one finishes."
        />
        <Toggle
          checked={settings.dataSaver}
          onChange={(v) => updateSettings({ dataSaver: v })}
          label="Data saver"
          hint="Prefers offline copies and lower quality streams."
        />
        <div className="setting-row">
          <span className="setting-copy">
            <span className="setting-label">Default quality</span>
            <span className="setting-hint">Used when a stream starts.</span>
          </span>
          <div className="quality-picker">
            {QUALITIES.map((q) => (
              <button
                key={q}
                type="button"
                className={`chip chip-sm ${settings.defaultQuality === q ? 'is-active' : ''}`}
                onClick={() => updateSettings({ defaultQuality: q })}
              >
                {q === 'auto' ? 'Auto' : q}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-group">
        <h2>Downloads</h2>
        <Toggle
          checked={settings.wifiOnlyDownloads}
          onChange={(v) => updateSettings({ wifiOnlyDownloads: v })}
          label="Download on Wi-Fi only"
          hint="Never spend mobile data on a download."
        />
        <div className="setting-row">
          <span className="setting-copy">
            <span className="setting-label">Stored on this device</span>
            <span className="setting-hint">
              {downloads.length} item{downloads.length === 1 ? '' : 's'} · {bytes(storage.usage)} of {bytes(storage.quota)}
            </span>
          </span>
          <button
            type="button"
            className="btn btn-small btn-ghost"
            onClick={() => {
              deleteAllDownloads()
              toast('All downloads removed')
            }}
          >
            <Trash size={14} /> Clear
          </button>
        </div>
        <div className="setting-row">
          <span className="setting-copy">
            <span className="setting-label">Offline folder</span>
            <span className="setting-hint">
              Saved files live in app storage; “Save to device” copies them to Movies/Cinejoy on Android.
            </span>
          </span>
          <DownloadIcon size={18} />
        </div>
      </section>

      <section className="settings-group">
        <h2>About</h2>
        <button type="button" className="list-row" onClick={() => void openExternal('https://cinejoy.pk/')}>
          <span>cinejoy.pk</span>
          <span className="muted">Open</span>
        </button>
        <button type="button" className="list-row" onClick={() => void openExternal(REPO_URL)}>
          <span>Source code</span>
          <span className="muted">GitHub</span>
        </button>
        <button
          type="button"
          className="list-row"
          onClick={() => void openExternal('https://www.themoviedb.org/')}
        >
          <span>Metadata &amp; artwork</span>
          <span className="muted">TMDB</span>
        </button>
        <div className="about-note">
          <Info size={16} />
          <p>
            Cinejoy is a client for a catalog of movies and series. This build ships a sample catalog and public
            demo streams so every feature can be tried without a backend; wire up the included scraper API for
            live data. Please respect the rights of content owners in your region.
          </p>
        </div>
      </section>

      <section className="settings-group">
        <h2>Data</h2>
        {confirmWipe ? (
          <div className="danger-box">
            <p>This deletes downloads, history and settings on this device.</p>
            <div className="danger-actions">
              <button type="button" className="btn btn-small btn-danger" onClick={() => void wipe()}>
                Delete everything
              </button>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmWipe(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="list-row" onClick={() => setConfirmWipe(true)}>
            <span>Clear all app data</span>
            <Trash size={16} />
          </button>
        )}
        {isNative() && (
          <button type="button" className="list-row" onClick={() => void exitApp()}>
            <span>Exit app</span>
            <span className="muted">Close</span>
          </button>
        )}
      </section>

      <p className="settings-foot">
        <Wifi size={13} /> Works offline once installed · no account required
      </p>
      <p className="settings-foot muted">
        <Check size={13} /> MIT licensed · built with React, hls.js and Capacitor
      </p>
    </div>
  )
}
