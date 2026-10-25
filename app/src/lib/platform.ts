/**
 * Bridge to Capacitor (the Android wrapper in ../android).
 *
 * Everything here is feature-detected so the exact same build runs as a plain
 * PWA in a browser: when the native plugins are missing we fall back to web
 * APIs (anchor download, CSS fullscreen, screen orientation lock…).
 */

type AnyRec = Record<string, any>

function cap(): AnyRec | undefined {
  return (globalThis as AnyRec).Capacitor
}

export function isNative(): boolean {
  const c = cap()
  return !!c?.isNativePlatform?.()
}

export function plugin(name: string): AnyRec | undefined {
  return cap()?.Plugins?.[name]
}

export function assetUrl(path: string): string {
  try {
    return new URL(path, document.baseURI).href
  } catch {
    return path
  }
}

/** Tell Android to keep the screen awake while a video is playing. */
export async function keepAwake(on: boolean): Promise<void> {
  const p = plugin('KeepAwake') ?? cap()?.Plugins?.KeepAwake
  try {
    if (p) {
      await (on ? p.keepAwake?.() : p.allowSleep?.())
      return
    }
    const wakeLock = (navigator as AnyRec).wakeLock
    if (on && wakeLock?.request) {
      const sentinel = await wakeLock.request('screen')
      ;(globalThis as AnyRec).__cjWakeLock = sentinel
      return
    }
    ;(globalThis as AnyRec).__cjWakeLock?.release?.()
  } catch {
    /* best effort */
  }
}

export async function setLandscape(landscape: boolean): Promise<void> {
  try {
    const so = screen.orientation as AnyRec
    if (landscape) await so?.lock?.('landscape')
    else so?.unlock?.()
  } catch {
    /* iOS/browsers without the API */
  }
  try {
    const p = plugin('ScreenOrientation')
    if (p) {
      await (landscape ? p.lock?.({ orientation: 'landscape' }) : p.unlock?.())
    }
  } catch {
    /* ignore */
  }
}

/** Hand a streaming URL to Android's own video player / external app. */
export async function openExternal(url: string, headers?: Record<string, string>): Promise<void> {
  const p = plugin('Browser')
  try {
    if (p?.open) {
      await p.open({ url })
      return
    }
  } catch {
    /* fall through */
  }
  const intent = plugin('IntentLauncher')
  if (intent?.startActivity) {
    try {
      await intent.startActivity({ action: 'android.intent.action.VIEW', data: url })
      return
    } catch {
      /* ignore */
    }
  }
  if (headers && Object.keys(headers).length) {
    // A plain window.open can't attach headers; keep the URL only.
  }
  window.open(url, '_blank', 'noopener')
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export interface SaveResult {
  ok: boolean
  where?: string
  message?: string
}

/**
 * Write a finished download somewhere the user can keep it:
 * Android → Movies/Cinejoy via Capacitor Filesystem, web → browser download.
 */
export async function saveFile(blob: Blob, filename: string): Promise<SaveResult> {
  const fs = plugin('Filesystem')
  if (fs?.writeFile) {
    try {
      const data = await blobToBase64(blob)
      await fs.writeFile({ path: `Download/Cinejoy/${filename}`, data, directory: 'EXTERNAL_STORAGE', recursive: true })
      await fs.writeFile({ path: `Documents/Cinejoy/${filename}`, data, directory: 'DOCUMENTS', recursive: true })
      return { ok: true, where: 'Movies/Cinejoy' }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Could not write the file' }
    }
  }
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
    return { ok: true, where: 'your downloads folder' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Could not save the file' }
  }
}

export async function shareFile(blob: Blob, filename: string, title: string): Promise<SaveResult> {
  const share = plugin('Share')
  if (share?.share && isNative()) {
    try {
      const data = await blobToBase64(blob)
      const fs = plugin('Filesystem')
      const res = await fs?.writeFile?.({ path: filename, data, directory: 'CACHE' })
      await share.share({ title, url: res?.uri, files: res?.uri ? [res.uri] : undefined })
      return { ok: true }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Share failed' }
    }
  }
  try {
    const file = new File([blob], filename, { type: blob.type || 'video/mp4' })
    const nav = navigator as AnyRec
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title })
      return { ok: true }
    }
  } catch {
    /* ignore */
  }
  return saveFile(blob, filename)
}

export async function vibrate(ms = 12): Promise<void> {
  try {
    const h = plugin('Haptics')
    if (h?.impact) {
      await h.impact({ style: 'LIGHT' })
      return
    }
    navigator.vibrate?.(ms)
  } catch {
    /* ignore */
  }
}

export async function statusBarDark(dark: boolean): Promise<void> {
  try {
    const sb = plugin('StatusBar')
    if (sb?.setStyle) {
      await sb.setStyle({ style: dark ? 'DARK' : 'LIGHT' })
      await sb.setBackgroundColor?.({ color: '#08080b' })
    }
  } catch {
    /* ignore */
  }
}

export async function exitApp(): Promise<void> {
  const app = plugin('App')
  try {
    await app?.exitApp?.()
  } catch {
    /* ignore */
  }
}
