import React, { useEffect } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Download, Home, Library, Search, Settings } from './components/Icons'
import { Toasts } from './components/ui'
import { useStore } from './lib/store'
import Browse from './pages/Browse'
import Downloads from './pages/Downloads'
import HomePage from './pages/Home'
import LibraryPage from './pages/Library'
import SearchPage from './pages/Search'
import SettingsPage from './pages/Settings'
import TitleDetail from './pages/TitleDetail'
import Watch from './pages/Watch'

const TABS = [
  { to: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' || p.startsWith('/browse') },
  { to: '/search', label: 'Search', icon: Search, match: (p: string) => p.startsWith('/search') },
  { to: '/downloads', label: 'Downloads', icon: Download, match: (p: string) => p.startsWith('/downloads') },
  { to: '/library', label: 'My list', icon: Library, match: (p: string) => p.startsWith('/library') },
  { to: '/settings', label: 'Settings', icon: Settings, match: (p: string) => p.startsWith('/settings') },
]

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

function TabBar() {
  const { pathname } = useLocation()
  const { downloads } = useStore()
  const busy = downloads.filter((d) => ['downloading', 'queued'].includes(d.status)).length
  return (
    <nav className="tabbar" aria-label="Main navigation">
      {TABS.map((t) => {
        const active = t.match(pathname)
        const Icon = t.icon
        return (
          <Link key={t.to} to={t.to} className={`tab ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
            <span className="tab-icon">
              <Icon size={22} />
              {t.to === '/downloads' && busy > 0 && <span className="tab-badge">{busy}</span>}
            </span>
            <span className="tab-label">{t.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const immersive = pathname.startsWith('/watch')
  return (
    <div className={`app-shell ${immersive ? 'is-immersive' : ''}`}>
      <ScrollToTop />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/browse/:kind" element={<Browse />} />
          <Route path="/title/:id" element={<TitleDetail />} />
          <Route path="/watch/:id" element={<Watch />} />
          <Route path="/watch/:id/:season/:episode" element={<Watch />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!immersive && <TabBar />}
      <Toasts />
    </div>
  )
}

/** Router entry point used by main.tsx (Hash routing keeps deep links working in a WebView). */
export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}
