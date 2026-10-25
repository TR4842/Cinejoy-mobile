import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { StoreProvider } from './lib/store'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root container missing')

// Hide the static splash once the app has painted.
function hideBoot() {
  const boot = document.getElementById('boot')
  if (!boot) return
  boot.classList.add('is-hidden')
  window.setTimeout(() => boot.remove(), 420)
}

createRoot(container).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
)

requestAnimationFrame(() => window.setTimeout(hideBoot, 350))

// Offline app shell (web builds only; the Android asset bundle doesn't need it).
if ('serviceWorker' in navigator && !(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href).catch(() => {
      /* offline shell is a nice-to-have */
    })
  })
}
