/**
 * cinejoy.pk reader.
 *
 * The site is server-rendered Next.js: every page ships the catalog payload in
 * its HTML (either a `__NEXT_DATA__` script, the RSC `self.__next_f.push(...)`
 * stream, or plain anchor markup). Rather than depending on one of those shapes
 * we mine whatever the page gives us, in order of reliability, and normalise it
 * into the `Title` shape the app uses.
 *
 * Nothing here bypasses the site's player: we only collect public metadata
 * (title, year, poster, rating, synopsis, episodes) and the stream URLs the
 * page itself references.
 */

const BASE = process.env.CINEJOY_BASE || 'https://cinejoy.pk'
const UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'

/* ------------------------------------------------------------------ fetch */

export async function fetchHtml(path, { timeout = 15000 } = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
      },
    })
    if (!res.ok) throw new Error(`${url} responded ${res.status}`)
    return { html: await res.text(), url, status: res.status }
  } finally {
    clearTimeout(timer)
  }
}

/* ----------------------------------------------------------------- helpers */

const NAMED = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  nbsp: ' ',
}

export function decodeEntities(s = '') {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+|#39);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m)
}

export function stripTags(s = '') {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/** Find every balanced `{...}` / `[...]` JSON literal inside a blob of text. */
function* jsonCandidates(text) {
  const seen = new Set()
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch !== '{' && ch !== '[') continue
    let depth = 0
    let inStr = false
    let esc = false
    for (let j = i; j < text.length; j++) {
      const c = text[j]
      if (inStr) {
        if (esc) esc = false
        else if (c === '\\') esc = true
        else if (c === '"') inStr = false
        continue
      }
      if (c === '"') inStr = true
      else if (c === '{' || c === '[') depth++
      else if (c === '}' || c === ']') {
        depth--
        if (depth === 0) {
          const chunk = text.slice(i, j + 1)
          if (chunk.length > 40 && !seen.has(chunk)) {
            seen.add(chunk)
            try {
              yield JSON.parse(chunk)
            } catch {
              /* not JSON */
            }
          }
          i = j
          break
        }
      }
    }
  }
}

const TMDB_IMAGE = 'https://image.tmdb.org/t/p'

function imagePath(v) {
  if (!v || typeof v !== 'string') return undefined
  if (v.startsWith('/')) return v
  if (v.startsWith(TMDB_IMAGE)) return v.slice(TMDB_IMAGE.length).replace(/^\/[a-z0-9]+/, '')
  if (v.startsWith('http')) return v
  return undefined
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) && n !== 0 ? n : undefined
}

function yearOf(v) {
  if (!v) return undefined
  const m = String(v).match(/(19|20)\d{2}/)
  return m ? Number(m[0]) : undefined
}

/* ------------------------------------------------------------- item mining */

/** Walk any parsed JSON looking for objects that look like a movie/series. */
function collectFromJson(root, out, depth = 0) {
  if (!root || typeof root !== 'object' || depth > 12) return
  if (Array.isArray(root)) {
    for (const v of root) collectFromJson(v, out, depth + 1)
    return
  }
  const title = root.title || root.name || root.original_title || root.original_name
  const isMedia =
    typeof title === 'string' &&
    title.length > 0 &&
    (root.media_type === 'movie' ||
      root.media_type === 'tv' ||
      root.type === 'movie' ||
      root.type === 'series' ||
      root.poster_path ||
      root.posterPath ||
      root.backdrop_path ||
      root.first_air_date ||
      root.release_date)
  if (isMedia) {
    const type = root.media_type || root.type || (root.first_air_date || root.name ? 'tv' : 'movie')
    const id = root.tmdbId || root.tmdb_id || root.id
    if (id !== undefined && id !== null && /^\d+$/.test(String(id))) {
      out.push({
        id: String(id),
        type: type === 'tv' || type === 'series' ? 'series' : 'movie',
        title,
        originalTitle: root.original_title || root.original_name || undefined,
        year: yearOf(root.release_date || root.first_air_date || root.year || root.air_date),
        rating: num(root.vote_average) ?? num(root.rating) ?? num(root.score),
        votes: num(root.vote_count) ?? num(root.votes),
        overview: typeof root.overview === 'string' ? root.overview : undefined,
        poster: imagePath(root.poster_path || root.posterPath || root.poster),
        backdrop: imagePath(root.backdrop_path || root.backdropPath || root.backdrop),
        genres: Array.isArray(root.genres)
          ? root.genres.map((g) => (typeof g === 'string' ? g : g?.name)).filter(Boolean)
          : Array.isArray(root.genre_names)
            ? root.genre_names
            : [],
        runtime: root.runtime ? formatRuntime(root.runtime) : undefined,
        certification: root.certification || root.rated || undefined,
        language: (root.original_language || root.language || '').toString().toUpperCase() || undefined,
        status: root.status || undefined,
        slug: root.slug || root.url || root.href || undefined,
      })
    }
  }
  for (const key of Object.keys(root)) {
    const v = root[key]
    if (v && typeof v === 'object') collectFromJson(v, out, depth + 1)
  }
}

function formatRuntime(mins) {
  const n = Number(mins)
  if (!Number.isFinite(n) || n <= 0) return undefined
  const h = Math.floor(n / 60)
  const m = n % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

const LINK_RE = /href="(https?:\/\/cinejoy\.pk)?\/(movie|series)\/(\d+)-([a-z0-9-]+)"/gi

/** Mine `/movie/<id>-<slug>` anchors — used when no JSON payload is present. */
export function collectFromLinks(html, out) {
  const byId = new Map(out.map((o) => [o.id, o]))
  let m
  const re = new RegExp(LINK_RE.source, 'gi')
  while ((m = re.exec(html))) {
    const [, , kind, id, slug] = m
    if (byId.has(id)) continue
    // The card markup can sit either side of the href, so scan a window
    // around the anchor and prefer the text inside it.
    const windowStart = Math.max(0, m.index - 700)
    const around = html.slice(windowStart, m.index + 700)
    const anchorEnd = around.indexOf('</a>', m.index - windowStart)
    const inner =
      anchorEnd > 0 ? around.slice(m.index - windowStart, anchorEnd) : around.slice(m.index - windowStart)
    const pick = (re) => [...(inner.matchAll(re) || [])].pop() || [...around.matchAll(re)].pop()
    const img = pick(/https:\/\/image\.tmdb\.org\/t\/p\/[^"'\s]+\/([A-Za-z0-9-]+\.(?:jpg|jpeg|png|webp))/g)
    const bold = pick(/\*\*([^*<>]{2,120})\*\*/g) || pick(/>([A-Z][^<>{}]{2,90})</g)
    const star = pick(/([0-9]+\.[0-9])\s*<\/?/g)
    const alt = pick(/alt="([^"]{2,120})"/g)
    const yearMatch = inner.match(/\b(19|20)\d{2}\b/g) || around.match(/\b(19|20)\d{2}\b/g)
    const title = decodeEntities(String(bold?.[1] || alt?.[1] || slug.replace(/-/g, ' ')).trim())
    const item = {
      id,
      type: kind === 'series' ? 'series' : 'movie',
      title: title.replace(/\s+/g, ' '),
      year: yearMatch ? Number(yearMatch[yearMatch.length - 1]) : undefined,
      rating: star ? Number(star[1]) : undefined,
      poster: img ? img[1] : undefined,
      genres: [],
      slug,
    }
    out.push(item)
    byId.set(id, item)
  }
  return out
}

/** Pull `<script id="__NEXT_DATA__">` / RSC flight payloads out of the HTML. */
export function collectFromEmbedded(html, out) {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]{200,}?)<\/script>/gi)].map((m) => m[1])
  for (const raw of scripts) {
    const text = raw.trim()
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        collectFromJson(JSON.parse(text), out)
        continue
      } catch {
        /* fall through to candidate scan */
      }
    }
    if (text.includes('__next_f') || text.includes('push(')) {
      for (const parsed of jsonCandidates(text)) collectFromJson(parsed, out)
    }
  }
  return out
}

/* ------------------------------------------------------------- page parsing */

const PROVIDERS = [
  'Netflix',
  'Amazon Prime Video',
  'Disney Plus',
  'Apple TV+',
  'Apple TV',
  'Hulu',
  'HBO Max',
  'Max',
  'Paramount Plus',
  'Peacock Premium',
  'Crunchyroll',
  'Starz',
  'AMC+',
  'MGM Plus',
  'YouTube Premium',
  'Tubi TV',
  'Pluto TV',
]

/** Extract the sections a listing page exposes: trending, new, popular series… */
export function parseListing(html) {
  const out = []
  collectFromEmbedded(html, out)
  if (out.length < 6) collectFromLinks(html, out)

  // provider logos give us a rough "where to watch" hint
  const provider = PROVIDERS.find((p) => html.includes(`alt="${p}"`))
  for (const item of out) {
    if (!item.provider && provider) item.provider = provider
    if (!item.pageUrl) item.pageUrl = `${BASE}/${item.type === 'series' ? 'series' : 'movie'}/${item.id}`
    if (item.type === 'series' && item.seasonCount === undefined) {
      const seasonsBlock = html.match(/(\d+)\s*Seasons?/i)
      if (seasonsBlock) item.seasonCount = Number(seasonsBlock[1])
    }
  }
  return dedupe(out)
}

export function dedupe(items) {
  const map = new Map()
  for (const it of items) {
    if (!it?.id || !it?.title) continue
    const prev = map.get(it.id)
    map.set(it.id, prev ? { ...prev, ...Object.fromEntries(Object.entries(it).filter(([, v]) => v !== undefined && v !== '')) } : it)
  }
  return [...map.values()]
}

export function parseTitlePage(html, id) {
  const out = []
  collectFromEmbedded(html, out)
  const found = out.find((o) => o.id === String(id))
  const base = found || parseListing(html).find((o) => o.id === String(id)) || { id: String(id), type: 'movie', title: '' }

  // --- synopsis: first long paragraph in the page
  if (!base.overview) {
    const paras = [...html.matchAll(/<p[^>]*>([\s\S]{60,600}?)<\/p>/gi)]
      .map((m) => stripTags(m[1]))
      .filter((t) => t.length > 60 && !/cookie|subscribe|sign in|login|advert/i.test(t))
    if (paras[0]) base.overview = paras[0]
  }

  // --- cast: anchors to /person/<id> with a preceding image
  const cast = []
  for (const m of html.matchAll(/\/person\/(\d+)[^>]*>([^<]{2,60})</gi)) {
    const name = decodeEntities(m[2]).trim()
    if (name && !cast.some((c) => c.name === name)) cast.push({ name })
    if (cast.length >= 14) break
  }
  if (cast.length) base.cast = cast

  // --- director / creators
  const dir = html.match(/Director:\s*(?:<[^>]+>\s*)*([^<]{2,60})/i)
  if (dir) base.director = decodeEntities(dir[1]).trim()
  const creators = html.match(/Creators?:\s*([\s\S]{0,400}?)<\/(?:p|div)>/i)
  if (creators) {
    const names = [...creators[1].matchAll(/>([^<>]{2,50})</g)].map((m) => decodeEntities(m[1]).trim()).filter(Boolean)
    if (names.length) base.creators = names
  }

  // --- trailer (youtube key)
  const trailer = html.match(/img\.youtube\.com\/vi\/([\w-]{11})\//)
  if (trailer) base.trailerKey = trailer[1]

  // --- episodes: /watch/tv/<series>/<season>/<episode>
  const eps = []
  for (const m of html.matchAll(/\/watch\/tv\/(\d+)\/(\d+)\/(\d+)/g)) {
    const [, sid, s, e] = m
    if (sid !== String(id)) continue
    const key = `${s}:${e}`
    if (eps.some((x) => x.key === key)) continue
    eps.push({ key, season: Number(s), episode: Number(e) })
  }
  if (eps.length) {
    const bySeason = new Map()
    for (const e of eps) {
      if (!bySeason.has(e.season)) bySeason.set(e.season, [])
      bySeason.get(e.season).push({
        id: `${id}-s${e.season}e${e.episode}`,
        season: e.season,
        number: e.episode,
        title: `Episode ${e.episode}`,
      })
    }
    base.seasons = [...bySeason.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([number, episodes]) => ({
        number,
        episodes: episodes.sort((a, b) => a.number - b.number),
      }))
    base.seasonCount = base.seasons.length
    base.type = 'series'
  }

  // --- poster / backdrop from meta tags if still missing
  if (!base.poster) {
    const og = html.match(/property="og:image"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:image"/i)
    if (og) base.poster = imagePath(og[1])
  }
  if (!base.rating) {
    const r = html.match(/★\s*([0-9]+(?:\.[0-9])?)/)
    if (r) base.rating = Number(r[1])
  }
  if (!base.title || (base.title && /Watch Free/i.test(base.title))) {
    const h1 = html.match(/<h1[^>]*>([\s\S]{1,160}?)<\/h1>/i)
    if (h1) {
      base.title = stripTags(h1[1]).replace(/\s*\((?:19|20)\d{2}\).*$/, '').trim()
    }
  }
  if (!base.title) {
    const t = html.match(/<title>([^<|]+)/i)
    if (t) {
      base.title = stripTags(t[1])
        .replace(/\s*[-–|]\s*Watch.*$/i, '')
        .replace(/\s*\((?:19|20)\d{2}\).*$/, '')
        .replace(/\s*Season\s+\d+.*$/i, '')
        .trim()
    }
  }
  if (base.title) base.title = base.title.replace(/\s*\((?:19|20)\d{2}\)\s*(?:Season\s+\d+)?\s*$/i, '').trim()
  base.pageUrl = `${BASE}/${base.type === 'series' ? 'series' : 'movie'}/${id}`
  base.year = base.year || yearOf(html.match(/Release Date<\/[^>]+>\s*<[^>]*>([^<]*\d{4})/i)?.[1])
  return base
}

/** Stream URLs referenced by a watch page (mp4 / m3u8 / file embeds). */
export function parseSources(html) {
  const sources = []
  const push = (url, kind, label) => {
    if (!url || sources.some((s) => s.url === url)) return
    sources.push({ id: label.toLowerCase().replace(/\s+/g, '-'), label, url, kind })
  }
  for (const m of html.matchAll(/["'](https?:\/\/[^"']+?\.m3u8[^"']*)["']/gi)) push(m[1], 'hls', 'Auto')
  for (const m of html.matchAll(/["'](https?:\/\/[^"']+?\.mp4[^"']*)["']/gi)) {
    const url = m[1]
    const q = url.match(/(\d{3,4})p?/) 
    push(url, 'mp4', q ? `${q[1]}p` : 'Source')
  }
  return sources
}

export { BASE }
