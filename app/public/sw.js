/* Cinejoy offline shell.
 * Caches the app itself (HTML/JS/CSS/icons) so the app opens with no network.
 * Video is never cached here — downloads go through the in-app download
 * manager, which stores finished files in IndexedDB so they can be listed,
 * paused, deleted and exported.
 */
const VERSION = 'cinejoy-v1'
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './media/poster.jpg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // never touch API or media range requests
  if (url.pathname.includes('/api/') || url.pathname.includes('/media/')) return

  // navigations: network first, cache fallback (offline launch)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(VERSION).then((c) => c.put('./index.html', copy)).catch(() => undefined)
          return res
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))),
    )
    return
  }

  // same-origin static assets: cache first
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone()
              caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => undefined)
            }
            return res
          }),
      ),
    )
  }
})
