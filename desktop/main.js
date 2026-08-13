const { app, BrowserWindow, session, shell } = require('electron')
const { execFile } = require('child_process')

/**
 * Native shell around the deployed web app.
 *
 * The point of this wrapper is the camera. In a browser tab, the camera prompt
 * comes back over and over (Safari in particular does not keep the grant), so
 * the app never just opens and starts tracking. Here the web-level prompt is
 * answered in code, and the only thing left is macOS asking once, at install
 * time, the same way it would for any native app.
 *
 * It loads the deployed URL rather than local files on purpose: the Spotify
 * redirect URI is registered against that exact origin, and PKCE would break
 * against a file:// or custom-protocol page.
 */

const APP_URL = 'https://home-gym-nine.vercel.app/'
const APP_ORIGIN = new URL(APP_URL).origin
/** Spotify's own pages have to load in-window so the auth code comes back. */
const AUTH_ORIGIN = 'https://accounts.spotify.com'

const isTrusted = (origin) => origin === APP_ORIGIN || origin === AUTH_ORIGIN

/**
 * Opens a URL in another app without pulling that app to the front.
 *
 * The web app starts music by handing the OS a `spotify:` URL, and
 * `shell.openExternal` launches Spotify *focused*, so the first thing you see
 * after picking a workout is Spotify rather than your first exercise.
 * macOS `open -g` launches in the background instead.
 *
 * The window is refocused as well, since Spotify pulls focus on its own when
 * it is cold-starting rather than merely being woken.
 */
function openInBackground(url, win) {
  execFile('open', ['-g', url], (err) => {
    // -g is macOS only and can fail if no handler is registered; a focused
    // launch still beats no music at all
    if (err) shell.openExternal(url)
  })

  /**
   * Focus is reclaimed repeatedly rather than once.
   *
   * A cold Spotify start takes several seconds and pulls focus when its window
   * finally appears, which is *after* any single reclaim would have run. These
   * offsets cover the launch, the splash and the window actually opening.
   * Reclaiming while already focused is a no-op, so the extra passes cost
   * nothing.
   */
  for (const delay of [600, 1500, 3000, 5000, 7000, 9000]) {
    setTimeout(() => {
      if (!win || win.isDestroyed()) return
      win.show()
      win.focus()
      app.focus({ steal: true })
    }, delay)
  }
}

const isSpotifyLaunch = (url) => url.startsWith('spotify:')


function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0c0b09',
    title: 'Reps',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      // nothing here needs Node, and the window loads remote code
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  /**
   * Marks the shell so the page can tell it is not in a plain browser.
   *
   * The page needs to ask the OS to start Spotify, and how it should do that
   * differs: a browser wants an anchor with a `spotify:` href, while the shell
   * wants `window.open`, which reliably lands in setWindowOpenHandler below
   * and can then be turned into a background launch. Guessing wrong means
   * either no music or Spotify stealing the screen.
   */
  win.webContents.setUserAgent(`${win.webContents.getUserAgent()} RepsShell/1`)

  win.loadURL(APP_URL)

  // Anything that tries to open a new window (a stray link) goes to the real
  // browser instead of spawning a second, unmanaged Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSpotifyLaunch(url)) openInBackground(url, win)
    else shell.openExternal(url)
    return { action: 'deny' }
  })

  // Keep in-window navigation on the app and the auth flow, nothing else.
  win.webContents.on('will-navigate', (event, url) => {
    if (isSpotifyLaunch(url)) {
      event.preventDefault()
      openInBackground(url, win)
      return
    }
    if (!isTrusted(new URL(url).origin)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  return win
}

app.whenReady().then(() => {
  const ses = session.defaultSession

  /**
   * Auto-grant the camera, scoped to our own origin.
   *
   * Both handlers are needed and they are not interchangeable: Chromium calls
   * the *check* handler when a page asks whether it already has permission,
   * and the *request* handler when it actually asks for it. Leaving the check
   * handler out makes getUserMedia stall on some launches.
   */
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    let origin = ''
    try {
      origin = new URL(webContents.getURL()).origin
    } catch {
      /* about:blank and friends have no origin: treat as untrusted */
    }
    callback(permission === 'media' && origin === APP_ORIGIN)
  })

  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
    permission === 'media' && requestingOrigin === APP_ORIGIN,
  )

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
