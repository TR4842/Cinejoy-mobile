import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Native shell for the Android build.
 *
 * The same web bundle runs here and in the browser; Capacitor simply serves
 * `dist/` from https://localhost inside a WebView and exposes the native
 * plugins the app feature-detects (Filesystem, Share, StatusBar…).
 */
const config: CapacitorConfig = {
  appId: 'pk.cinejoy.app',
  appName: 'Cinejoy',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#08080b',
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#08080b',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#08080b',
      overlaysWebView: false,
    },
  },
}

export default config
