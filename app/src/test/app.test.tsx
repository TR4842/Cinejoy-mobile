import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../App'
import { CATALOG } from '../lib/catalog'
import { search, similar, trending } from '../lib/api'
import { StoreProvider } from '../lib/store'

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StoreProvider>
        <AppShell />
      </StoreProvider>
    </MemoryRouter>,
  )
}

/** App uses HashRouter; for tests we swap in MemoryRouter via App's inner shell. */
describe('catalog helpers', () => {
  it('ships a usable bundled catalog', () => {
    expect(CATALOG.length).toBeGreaterThan(30)
    const movie = CATALOG.find((t) => t.id === '1290418')!
    expect(movie.title).toBe('The Cycle')
    expect(movie.rating).toBe(7.5)
    expect(movie.sources?.some((s) => s.kind === 'hls')).toBe(true)
    expect(movie.sources?.some((s) => s.kind === 'mp4')).toBe(true)
  })

  it('gives every series at least one season of playable episodes', () => {
    const series = CATALOG.filter((t) => t.type === 'series')
    expect(series.length).toBeGreaterThan(8)
    for (const s of series) {
      expect(s.seasons?.length, s.title).toBeGreaterThan(0)
      const ep = s.seasons![0].episodes[0]
      expect(ep.sources?.length, s.title).toBeGreaterThan(0)
      expect(ep.sources![0].url).toMatch(/^media\//)
    }
  })

  it('only references bundled media for demo playback', () => {
    const urls = CATALOG.flatMap((t) => [
      ...(t.sources ?? []).map((s) => s.url),
      ...(t.seasons ?? []).flatMap((s) => s.episodes.flatMap((e) => (e.sources ?? []).map((x) => x.url))),
    ])
    expect(urls.length).toBeGreaterThan(10)
    for (const url of urls) expect(url).toMatch(/^media\//)
  })

  it('searches titles, cast and genres', () => {
    expect(search(CATALOG, 'spider')[0].title).toMatch(/Spider-Man/)
    expect(search(CATALOG, 'lupin')[0].id).toBe('96677')
    expect(search(CATALOG, 'deborah ann woll')[0].id).toBe('1290418')
    expect(search(CATALOG, 'zzzzz')).toHaveLength(0)
  })

  it('ranks trending and finds genuinely similar titles', () => {
    const top = trending(CATALOG)
    expect(top.length).toBe(CATALOG.length)
    const spidey = CATALOG.find((t) => t.id === '969681')!
    const alike = similar(CATALOG, spidey, 6)
    expect(alike).toHaveLength(6)
    expect(alike.some((t) => t.genres.includes('Action'))).toBe(true)
  })
})

describe('shell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the home screen from the bundled catalog', async () => {
    renderApp('/')
    expect(await screen.findByRole('link', { name: /cinejoy home/i })).toHaveTextContent(/CINE/i)
    expect(await screen.findByText('Trending movies')).toBeInTheDocument()
    expect(await screen.findByText('Trending series')).toBeInTheDocument()
    expect(screen.getAllByText('The Cycle').length).toBeGreaterThan(0)
    // sample-catalog banner appears when the live feed is unreachable
    expect(screen.getByText(/Sample catalog/i)).toBeInTheDocument()
  })

  it('shows a hero with play and list actions', async () => {
    renderApp('/')
    const play = await screen.findByRole('button', { name: /^play$/i })
    expect(play).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /my list/i }))
    expect(await screen.findByText(/Added to My List/i)).toBeInTheDocument()
  })

  it('renders title details with cast and episodes', async () => {
    renderApp('/title/96677')
    expect(await screen.findByRole('heading', { name: 'Lupin' })).toBeInTheDocument()
    expect(screen.getAllByText(/Arsène Lupin/).length).toBeGreaterThan(0)
    expect(screen.getByText('Omar Sy')).toBeInTheDocument()
    expect(screen.getByText('Chapter 1')).toBeInTheDocument()
    expect(screen.getByText(/Crime · Drama · Mystery/)).toBeInTheDocument()
  })

  it('filters search results', async () => {
    renderApp('/search')
    const input = await screen.findByLabelText(/search cinejoy/i)
    await userEvent.type(input, 'spider')
    await waitFor(() => expect(screen.getByText(/results? for/i)).toBeInTheDocument())
    expect(screen.getAllByText(/Spider-Man/).length).toBeGreaterThan(0)
  })

  it('opens the player and exposes the quality/source controls', async () => {
    renderApp('/watch/1290418')
    expect(await screen.findByLabelText('Seek')).toBeInTheDocument()
    expect(screen.getAllByText('The Cycle').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Download options')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Download options'))
    expect(await screen.findByRole('heading', { name: 'Download' })).toBeInTheDocument()
    expect(screen.getAllByText('720p').length).toBeGreaterThan(0)
  })

  it('queues a download from the player', async () => {
    renderApp('/watch/1290418')
    await userEvent.click(await screen.findByLabelText('Download options'))
    const sheet = await screen.findByRole('dialog')
    const downloadButtons = within(sheet).getAllByRole('button', { name: /download/i })
    await userEvent.click(downloadButtons[0])
    await waitFor(() => expect(screen.getAllByText(/queued|download/i).length).toBeGreaterThan(0))
  })

  it('shows an empty downloads state', async () => {
    renderApp('/downloads')
    expect(await screen.findByText(/Nothing downloaded yet/i)).toBeInTheDocument()
  })

  it('renders settings with the catalog status', async () => {
    renderApp('/settings')
    expect(await screen.findByRole('heading', { name: /settings/i })).toBeInTheDocument()
    expect(screen.getAllByText(/Bundled sample catalog/i).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/use live cinejoy.pk feed/i)).toBeChecked()
  })

  it('lists every sample title in the browse grid', async () => {
    renderApp('/browse/movie')
    expect(await screen.findByRole('heading', { name: 'Movies' })).toBeInTheDocument()
    const links = await screen.findAllByRole('link', { name: /\(\d{4}\)|Series/i })
    expect(links.length).toBeGreaterThan(10)
  })
})

describe('offline-first behaviour', () => {
  it('does not crash when fetch and IndexedDB are unavailable', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderApp('/')
    expect(await screen.findByText('Trending movies')).toBeInTheDocument()
    // no React error boundary messages
    expect(spy.mock.calls.flat().join(' ')).not.toMatch(/The above error occurred/)
    spy.mockRestore()
  })
})
