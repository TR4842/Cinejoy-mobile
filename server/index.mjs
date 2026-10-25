/**
 * Cinejoy companion API.
 *
 * Serves the Cinejoy mobile app with a live catalog scraped from cinejoy.pk and
 * caches it so the site isn't hammered. Zero dependencies — just node:http.
 *
 *   node server/index.mjs              # http://0.0.0.0:8787
 *   PORT=9000 CINEJOY_BASE=https://cinejoy.pk node server/index.mjs
 *
 * Endpoints
 *   GET /api/health              → { ok, upstream, cache }
 *   GET /api/catalog?limit=200   → { items: Title[], origin, fetchedAt }
 *   GET /api/title/:id           → Title (with seasons, cast, sources)
 *   GET /api/search?q=...        → { items }
 *   GET /api/sources/:type/:id[/:season/:episode] → { sources }
 *   GET /*                       → static app (dist/) when it exists
 */

import { createReadStream, existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BASE,
  dedupe,
  fetchHtml,
  parseListing,
  parseSources,
  parseTitlePage,
} from './scraper.mjs'

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '0.0.0.0'
const DIST = resolve(fileURLToPath(new URL('../app/dist', import.meta.url)))
const CATALOG_TTL = Number(process.env.CATALOG_TTL_MS || 15 * 60 * 1000)
const TITLE_TTL = Number(process.env.TITLE_TTL_MS || 30 * 60 * 1000)

const cache = {
  catalog: { at: 0, value: null, error: null },
  titles: new Map(), // id -> { at, value }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,HEAD,OPTIONS',
  'access-control-allow-headers': 'content-type,range',
  'access-control-expose-headers': 'content-length,content-range,accept-ranges',
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
    ...CORS,
  })
  res.end(payload)
}

function log(...args) {
  console.log(new Date().toISOString(), ...args)
}

/* --------------------------------------------------------------- data layer */

async function getCatalog({ limit = 200, force = false } = {}) {
  const fresh = !force && cache.catalog.value && Date.now() - cache.catalog.at < CATALOG_TTL
  if (fresh) return cache.catalog

  if (cache.catalog.inflight && !force) return cache.catalog.inflight

  const task = (async () => {
    try {
      const pages = ['/', '/category/movie/trending', '/category/tv/trending']
      const items = []
      for (const path of pages) {
        try {
          const { html } = await fetchHtml(path)
          items.push(...parseListing(html))
        } catch (err) {
          log('listing failed', path, err.message)
        }
      }
      const unique = dedupe(items).slice(0, limit)
      if (!unique.length) throw new Error('no titles found on the listing pages')
      cache.catalog = { at: Date.now(), value: unique, error: null, inflight: null }
      log(`catalog refreshed: ${unique.length} titles`)
      return cache.catalog
    } catch (err) {
      cache.catalog = { ...cache.catalog, inflight: null, error: err.message }
      log('catalog refresh failed:', err.message)
      return cache.catalog
    }
  })()

  cache.catalog.inflight = task
  return task
}

async function getTitle(id, { force = false } = {}) {
  const hit = cache.titles.get(id)
  if (!force && hit && Date.now() - hit.at < TITLE_TTL) return hit.value

  // try /movie/<id> then /series/<id> (the site redirects to the slugged URL)
  const errors = []
  for (const kind of ['movie', 'series']) {
    try {
      const { html } = await fetchHtml(`/${kind}/${id}`)
      const parsed = parseTitlePage(html, id)
      parsed.sources = parsed.sources?.length ? parsed.sources : parseSources(html)
      if (parsed.title) {
        cache.titles.set(id, { at: Date.now(), value: parsed })
        return parsed
      }
    } catch (err) {
      errors.push(`${kind}: ${err.message}`)
    }
  }
  if (hit) return hit.value
  throw new Error(errors.join(' | ') || 'title not found')
}

/* --------------------------------------------------------------- static files */

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname)
  if (rel.endsWith('/')) rel += 'index.html'
  const file = normalize(join(DIST, rel))
  if (!file.startsWith(DIST)) return false
  if (!existsSync(file) || !statSync(file).isFile()) {
    // SPA fallback for hash routing (keeps /some/path working)
    const index = join(DIST, 'index.html')
    if (!existsSync(index)) return false
    res.writeHead(200, { 'content-type': MIME['.html'] })
    createReadStream(index).pipe(res)
    return true
  }
  const stat = statSync(file)
  const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream'
  const range = req.headers.range
  const isMedia = /^video\/|mpegurl|mp2t/.test(type)

  if (range && isMedia) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    const start = m?.[1] ? Number(m[1]) : 0
    const end = m?.[2] ? Number(m[2]) : stat.size - 1
    if (start >= stat.size) {
      res.writeHead(416, { 'content-range': `bytes */${stat.size}`, ...CORS })
      return res.end()
    }
    res.writeHead(206, {
      'content-type': type,
      'content-length': end - start + 1,
      'content-range': `bytes ${start}-${end}/${stat.size}`,
      'accept-ranges': 'bytes',
      ...CORS,
    })
    return createReadStream(file, { start, end }).pipe(res)
  }

  res.writeHead(200, {
    'content-type': type,
    'content-length': stat.size,
    'accept-ranges': 'bytes',
    'cache-control': isMedia ? 'public, max-age=86400' : 'no-cache',
    ...CORS,
  })
  if (req.method === 'HEAD') return res.end()
  createReadStream(file).pipe(res)
  return true
}

/* -------------------------------------------------------------------- routes */

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const path = url.pathname

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
  }

  try {
    if (path === '/api/health') {
      return json(res, 200, {
        ok: true,
        upstream: BASE,
        cachedTitles: cache.catalog.value?.length ?? 0,
        catalogAgeMs: cache.catalog.at ? Date.now() - cache.catalog.at : null,
        lastError: cache.catalog.error,
      })
    }

    if (path === '/api/catalog') {
      const limit = Math.min(400, Math.max(1, Number(url.searchParams.get('limit')) || 200))
      const force = url.searchParams.get('refresh') === '1'
      const result = await getCatalog({ limit, force })
      if (result.value?.length) {
        return json(res, 200, {
          items: result.value.slice(0, limit),
          origin: `cinejoy.pk (${result.value.length} titles)`,
          fetchedAt: result.at,
        })
      }
      return json(res, 502, {
        items: [],
        error: result.error || 'upstream unavailable',
        hint: 'The app falls back to its bundled catalog automatically.',
      })
    }

    if (path === '/api/search') {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase()
      if (!q) return json(res, 400, { error: 'q is required' })
      const result = await getCatalog({})
      const items = (result.value || []).filter((t) =>
        `${t.title} ${t.year || ''} ${(t.genres || []).join(' ')}`.toLowerCase().includes(q),
      )
      return json(res, 200, { items })
    }

    const titleMatch = path.match(/^\/api\/title\/(\d+)$/)
    if (titleMatch) {
      try {
        const title = await getTitle(titleMatch[1], { force: url.searchParams.get('refresh') === '1' })
        return json(res, 200, title)
      } catch (err) {
        return json(res, 404, { error: err.message })
      }
    }

    const sourcesMatch = path.match(/^\/api\/sources\/(movie|series)\/(\d+)(?:\/(\d+)\/(\d+))?$/)
    if (sourcesMatch) {
      const [, kind, id, season, episode] = sourcesMatch
      try {
        const target = season
          ? `/${kind}/${id}/season/${season}/episode/${episode}`
          : `/${kind}/${id}`
        const { html } = await fetchHtml(target)
        const sources = parseSources(html)
        if (!sources.length) {
          return json(res, 404, {
            sources: [],
            error: 'No direct stream URLs on that page (the site player is usually an iframe).',
          })
        }
        return json(res, 200, { sources })
      } catch (err) {
        return json(res, 502, { sources: [], error: err.message })
      }
    }

    if (path.startsWith('/api/')) {
      return json(res, 404, { error: `unknown endpoint ${path}` })
    }

    if (DIST && existsSync(DIST)) {
      if (serveStatic(req, res, path)) return
    }

    return json(res, 404, {
      error: 'not found',
      hint: 'Run the app with `npm run dev` (Vite proxies /api here) or build it with `npm run build`.',
    })
  } catch (err) {
    log('unhandled', err)
    return json(res, 500, { error: err?.message || 'internal error' })
  }
})

server.listen(PORT, HOST, () => {
  log(`Cinejoy API on http://${HOST}:${PORT}`)
  log(`upstream: ${BASE}`)
  log(`static app: ${existsSync(DIST) ? DIST : '(not built — run npm run build in app/)'}`)
})

// Warm the catalog in the background so the first app load is instant.
void getCatalog({}).then((r) => {
  if (!r.value?.length) log('warmup: upstream unreachable, app will use the bundled catalog')
})

export { getCatalog, getTitle, server }
