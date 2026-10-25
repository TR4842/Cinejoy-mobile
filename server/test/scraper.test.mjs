/**
 * Offline tests for the cinejoy.pk readers.
 *
 * The sandbox (and CI) can't always reach cinejoy.pk, so the fixtures below are
 * trimmed copies of the real markup shapes: a Next.js listing that embeds a JSON
 * payload, a plain anchor-based listing, and a title page with cast, episodes and
 * a stream URL.
 *
 *   node --test server/test
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  collectFromEmbedded,
  collectFromLinks,
  decodeEntities,
  dedupe,
  parseListing,
  parseSources,
  parseTitlePage,
  stripTags,
} from '../scraper.mjs'

const NEXT_DATA_LISTING = `<!doctype html><html><head><title>Cinejoy</title></head><body>
<div id="__next"></div>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: {
    pageProps: {
      trending: [
        {
          id: 1290418,
          media_type: 'movie',
          title: 'The Cycle',
          release_date: '2026-09-23',
          vote_average: 7.5,
          vote_count: 10,
          poster_path: '/n5gSNf55KWfDc9hqP4H1KCCSutE.jpg',
          backdrop_path: '/uRIItK2ahR1ewVSBICiBFQrAVB2.jpg',
          overview: "A daughter unravels her father's dark past.",
          genres: [{ id: 80, name: 'Crime' }],
          runtime: 111,
        },
        {
          id: 96677,
          media_type: 'tv',
          name: 'Lupin',
          first_air_date: '2021-01-07',
          vote_average: 7.7,
          poster_path: '/h6Z2oogE4mJk2uffdtIlLhb0EHx.jpg',
          number_of_seasons: 3,
        },
      ],
    },
  },
})}</script>
</body></html>`

const ANCHOR_LISTING = `<div class="card">
  <a href="https://cinejoy.pk/movie/969681-spider-man-brand-new-day-2026">
    <img src="https://image.tmdb.org/t/p/w500/bjiS5ipwxb9JFy3XRRN4OAilSeX.jpg" alt="Spider-Man: Brand New Day" />
    **Spider-Man: Brand New Day** 2026 8.5
  </a>
</div>
<div class="card">
  <a href="/series/120911-the-terminal-list-2022">
    <img src="https://image.tmdb.org/t/p/w500/xyFAzP7RKK8cARCSalIZ9A9T0jV.jpg" alt="The Terminal List" />
    **The Terminal List** 2022 8.0
  </a>
</div>`

const TITLE_PAGE = `<!doctype html><html><head>
<meta property="og:image" content="https://image.tmdb.org/t/p/w780/aY7zv2pfk9H0QxaaL3PBjvalbKQ.jpg" />
<title>Lupin (2021) Season 1 - Watch Free | Cinejoy</title>
</head><body>
<h1>Lupin</h1>
<p>Inspired by the adventures of Arsène Lupin, gentleman thief Assane Diop sets out to avenge his father for an injustice inflicted by a wealthy family.</p>
<p>Runtime1h 51m •Ends 8:48 AM</p>
<div>Creators: <a href="/person/1287248">George Kay</a>, <a href="/person/1618156">François Uzan</a></div>
<p>Director: <a href="/person/1">Jordan Downey</a></p>
<span>★ 7.7</span>
<a href="/person/9001">Omar Sy</a>
<a href="/person/9002">Ludivine Sagnier</a>
<a href="/watch/tv/96677/1/1">Chapter 1</a>
<a href="/watch/tv/96677/1/2">Chapter 2</a>
<a href="/watch/tv/96677/2/1">Chapter 1</a>
<img src="https://img.youtube.com/vi/m8vcBN8uza8/mqdefault.jpg" />
<script>
  window.__PLAYER__ = {"sources":[{"file":"https://cdn.example.com/lupin/s1/e1/master.m3u8"},{"file":"https://cdn.example.com/lupin/s1/e1/720p.mp4"},{"file":"https://cdn.example.com/lupin/s1/e1/480p.mp4"}]}
</script>
</body></html>`

test('decodes entities and strips tags', () => {
  assert.equal(decodeEntities('Tom &amp; Jerry &#39;90 &quot;x&quot;'), 'Tom & Jerry \'90 "x"')
  assert.equal(stripTags('<p>Hello <b>world</b></p>'), 'Hello world')
})

test('reads a Next.js JSON payload', () => {
  const items = collectFromEmbedded(NEXT_DATA_LISTING, [])
  assert.equal(items.length, 2)
  const cycle = items.find((i) => i.id === '1290418')
  assert.equal(cycle.title, 'The Cycle')
  assert.equal(cycle.type, 'movie')
  assert.equal(cycle.year, 2026)
  assert.equal(cycle.rating, 7.5)
  assert.equal(cycle.poster, '/n5gSNf55KWfDc9hqP4H1KCCSutE.jpg')
  assert.deepEqual(cycle.genres, ['Crime'])
  assert.equal(cycle.runtime, '1h 51m')
  const lupin = items.find((i) => i.id === '96677')
  assert.equal(lupin.type, 'series')
  assert.equal(lupin.year, 2021)
})

test('falls back to anchor markup', () => {
  const items = collectFromLinks(ANCHOR_LISTING, [])
  assert.equal(items.length, 2)
  assert.equal(items[0].title, 'Spider-Man: Brand New Day')
  assert.equal(items[0].type, 'movie')
  assert.equal(items[0].year, 2026)
  assert.equal(items[0].poster, 'bjiS5ipwxb9JFy3XRRN4OAilSeX.jpg')
  assert.equal(items[1].type, 'series')
  assert.match(items[1].title, /Terminal List/)
})

test('parseListing normalises a page', () => {
  const items = parseListing(NEXT_DATA_LISTING)
  assert.ok(items.length >= 2)
  for (const item of items) {
    assert.ok(item.pageUrl.includes('cinejoy.pk'))
    assert.ok(Array.isArray(item.genres))
  }
})

test('parseTitlePage extracts details, cast and episodes', () => {
  const title = parseTitlePage(TITLE_PAGE, 96677)
  assert.equal(title.title, 'Lupin')
  assert.match(title.overview, /Arsène Lupin/)
  assert.equal(title.rating, 7.7)
  assert.equal(title.trailerKey, 'm8vcBN8uza8')
  assert.equal(title.type, 'series')
  assert.equal(title.seasonCount, 2)
  assert.deepEqual(
    title.seasons.map((s) => [s.number, s.episodes.length]),
    [
      [1, 2],
      [2, 1],
    ],
  )
  assert.ok(title.cast.some((c) => c.name === 'Omar Sy'))
  assert.ok(title.creators.includes('George Kay'))
  assert.equal(title.director, 'Jordan Downey')
  assert.equal(title.poster, '/aY7zv2pfk9H0QxaaL3PBjvalbKQ.jpg')
})

test('parseSources finds HLS and progressive files', () => {
  const sources = parseSources(TITLE_PAGE)
  assert.equal(sources.filter((s) => s.kind === 'hls').length, 1)
  assert.equal(sources.filter((s) => s.kind === 'mp4').length, 2)
  assert.ok(sources.every((s) => s.url.startsWith('https://cdn.example.com')))
  assert.ok(sources.some((s) => s.label === '720p'))
})

test('dedupe keeps the richest record', () => {
  const merged = dedupe([
    { id: '1', title: 'A', type: 'movie' },
    { id: '1', title: 'A', type: 'movie', rating: 8, poster: '/x.jpg' },
    { id: '2', title: 'B', type: 'series' },
  ])
  assert.equal(merged.length, 2)
  assert.equal(merged[0].rating, 8)
  assert.equal(merged[0].poster, '/x.jpg')
})
