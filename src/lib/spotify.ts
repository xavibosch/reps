/**
 * Spotify Connect, not the Web Playback SDK.
 *
 * The app never plays audio itself: it reads and controls whichever Spotify
 * client is already running (Mac app, phone, speaker). That is what makes the
 * same code work on desktop and mobile, and it sidesteps the Web Playback
 * SDK's lack of iOS support.
 *
 * Auth is Authorization Code + PKCE, so there is no client secret and no
 * backend: everything runs in the browser and costs nothing to host.
 */

const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API = 'https://api.spotify.com/v1'

const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  // needed to list playlists for the switcher; private ones need the -private scope
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ')

/** Bumped when SCOPES changes, so a stale token is discarded instead of 403ing. */
const SCOPE_VERSION = '2'

const K_CLIENT = 'sp.clientId'
const K_VERIFIER = 'sp.verifier'
const K_TOKEN = 'sp.token'

type Tokens = { access_token: string; refresh_token?: string; expires_at: number; scopeVersion?: string }

export const getClientId = () =>
  localStorage.getItem(K_CLIENT) || (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) || ''
export const setClientId = (id: string) => localStorage.setItem(K_CLIENT, id.trim())

/** Must match the URI registered in the Spotify dashboard, character for character. */
export const redirectUri = () => `${window.location.origin}/`

const readTokens = (): Tokens | null => {
  try {
    const t = JSON.parse(localStorage.getItem(K_TOKEN) || 'null') as Tokens | null
    // A token minted before a scope was added cannot be refreshed into the new
    // scope, so drop it and force a fresh consent instead of 403ing later.
    if (t && t.scopeVersion !== SCOPE_VERSION) return null
    return t
  } catch {
    return null
  }
}
const writeTokens = (t: Omit<Tokens, 'scopeVersion'>) =>
  localStorage.setItem(K_TOKEN, JSON.stringify({ ...t, scopeVersion: SCOPE_VERSION }))
export const logout = () => localStorage.removeItem(K_TOKEN)
export const isConnected = () => !!readTokens()

const randomString = (len: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => ('0' + b.toString(16)).slice(-2)).join('')
}

const base64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

export async function login() {
  const clientId = getClientId()
  if (!clientId) throw new Error('Missing Spotify client id')

  const verifier = randomString(48)
  sessionStorage.setItem(K_VERIFIER, verifier)
  const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  })
  window.location.href = `${AUTH_URL}?${params}`
}

/** Call once on boot. Returns true if it consumed an auth redirect. */
export async function handleRedirect(): Promise<boolean> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) {
    history.replaceState({}, '', url.pathname)
    throw new Error(`Spotify denied the request: ${error}`)
  }
  if (!code) return false

  const verifier = sessionStorage.getItem(K_VERIFIER)
  if (!verifier) {
    history.replaceState({}, '', url.pathname)
    return false
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getClientId(),
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  })

  history.replaceState({}, '', url.pathname)
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`)

  const data = await res.json()
  writeTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  })
  sessionStorage.removeItem(K_VERIFIER)
  return true
}

async function refresh(tokens: Tokens): Promise<Tokens | null> {
  if (!tokens.refresh_token) return null
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getClientId(),
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const next: Tokens = {
    access_token: data.access_token,
    // Spotify may or may not return a new refresh token; keep the old one.
    refresh_token: data.refresh_token || tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }
  writeTokens(next)
  return next
}

async function accessToken(): Promise<string | null> {
  let tokens = readTokens()
  if (!tokens) return null
  // refresh a minute early so a request never races the expiry
  if (Date.now() > tokens.expires_at - 60_000) {
    tokens = await refresh(tokens)
    if (!tokens) {
      logout()
      return null
    }
  }
  return tokens.access_token
}

async function call(path: string, init: RequestInit = {}): Promise<Response | null> {
  const token = await accessToken()
  if (!token) return null
  return fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  })
}

export type NowPlaying = {
  /** Track id, used to detect an actual song change rather than a re-poll. */
  trackId: string
  title: string
  artist: string
  album: string
  art?: string
  isPlaying: boolean
  progressMs: number
  durationMs: number
  deviceName?: string
  /** null when the active device does not expose volume control. */
  volume: number | null
  contextName?: string
}

/** null = not connected. 'no-device' = connected but nothing is playing anywhere. */
export async function getNowPlaying(): Promise<NowPlaying | 'no-device' | null> {
  const res = await call('/me/player')
  if (!res) return null
  if (res.status === 204) return 'no-device'
  if (!res.ok) return res.status === 401 ? null : 'no-device'

  const d = await res.json()
  if (!d || !d.item) return 'no-device'
  return {
    trackId: d.item.id ?? d.item.uri ?? d.item.name,
    title: d.item.name,
    artist: (d.item.artists || []).map((a: { name: string }) => a.name).join(', '),
    album: d.item.album?.name ?? '',
    art: d.item.album?.images?.[0]?.url,
    isPlaying: !!d.is_playing,
    progressMs: d.progress_ms ?? 0,
    durationMs: d.item.duration_ms ?? 0,
    deviceName: d.device?.name,
    volume: typeof d.device?.volume_percent === 'number' ? d.device.volume_percent : null,
  }
}

/** Not every device supports this: Connect speakers and some phones refuse. */
export const setVolume = (percent: number) =>
  call(`/me/player/volume?volume_percent=${Math.min(100, Math.max(0, Math.round(percent)))}`, { method: 'PUT' })

export type Playlist = { id: string; uri: string; name: string; art?: string; tracks: number }

export async function getPlaylists(): Promise<Playlist[]> {
  const res = await call('/me/playlists?limit=50')
  if (!res || !res.ok) return []
  const d = await res.json()
  return (d.items || []).map((p: Record<string, any>) => ({
    id: p.id,
    uri: p.uri,
    name: p.name,
    art: p.images?.[0]?.url,
    tracks: p.tracks?.total ?? 0,
  }))
}

/** Starts a playlist (or album/artist) on the active device. */
export const playContext = (contextUri: string) =>
  call('/me/player/play', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context_uri: contextUri }),
  })

export type QueueTrack = { id: string; title: string; artist: string; art?: string }

/**
 * Upcoming tracks, used to fan out the coverflow.
 *
 * Polled far less often than /me/player: the queue only changes when the
 * track does, and this endpoint is heavier.
 */
export async function getQueue(): Promise<QueueTrack[]> {
  const res = await call('/me/player/queue')
  if (!res || !res.ok) return []
  const d = await res.json()
  const items = [d.currently_playing, ...(d.queue || [])].filter(Boolean)
  return items.slice(0, 5).map((it: Record<string, any>) => ({
    id: it.id,
    title: it.name,
    artist: (it.artists || []).map((a: { name: string }) => a.name).join(', '),
    art: it.album?.images?.[0]?.url,
  }))
}

/** Previously played tracks, so the coverflow has something on its left side. */
export async function getRecent(): Promise<QueueTrack[]> {
  const res = await call('/me/player/recently-played?limit=3')
  if (!res || !res.ok) return []
  const d = await res.json()
  return (d.items || []).map((i: Record<string, any>) => ({
    id: i.track.id,
    title: i.track.name,
    artist: (i.track.artists || []).map((a: { name: string }) => a.name).join(', '),
    art: i.track.album?.images?.[0]?.url,
  }))
}

type Device = { id: string; name: string; is_active: boolean }

async function getDevices(): Promise<Device[]> {
  const res = await call('/me/player/devices')
  if (!res || !res.ok) return []
  const d = await res.json()
  return d.devices || []
}

/**
 * Starts music without the user touching Spotify first.
 *
 * A plain play call 404s when no device is "active", which is the normal state
 * if the desktop app is merely open and idle. Spotify still lists such a device
 * though, so transferring playback to it wakes it up. Only when the account has
 * no device at all is there nothing the API can do, and the desktop app has to
 * be launched via its protocol handler.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The desktop shell tags its user agent so the page can tell them apart. */
const inShell = () => navigator.userAgent.includes('RepsShell')

/**
 * Hands the `spotify:` URL to the OS.
 *
 * Two routes, because the right one depends on where this is running. In the
 * shell, `window.open` is what reliably reaches the main process, which then
 * launches Spotify in the background and takes focus back. In a browser there
 * is no main process to catch it and `window.open` risks a blocked popup, so
 * a hidden anchor is the safe handoff.
 */
function askOsToOpenSpotify(): boolean {
  try {
    if (inShell()) {
      window.open('spotify:')
      return true
    }
    const a = document.createElement('a')
    a.href = 'spotify:'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
    return true
  } catch {
    return false
  }
}

/** One attempt: play directly, else wake whichever device is registered. */
async function tryPlay(): Promise<boolean> {
  const direct = await call('/me/player/play', { method: 'PUT' })
  if (direct && direct.ok) return true

  const devices = await getDevices()
  const target = devices.find((d) => d.is_active) ?? devices[0]
  if (!target) return false

  const moved = await call('/me/player', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [target.id], play: true }),
  })
  return !!moved && moved.ok
}

export async function wakeAndPlay(): Promise<'playing' | 'failed'> {
  if (await tryPlay()) return 'playing'

  // Nothing registered at all, so Spotify is not running: ask the OS to start
  // it. The desktop shell turns this into a background launch and pulls focus
  // back; in a plain browser it is an ordinary protocol handoff.
  if (!askOsToOpenSpotify()) return 'failed'

  /**
   * A cold Spotify takes seconds to appear on the account as a device, and it
   * does not appear all at once: it registers before it will accept playback.
   * Retrying across roughly twelve seconds covers the slow start without
   * hammering the API.
   */
  for (const wait of [1500, 2000, 2500, 3000, 3000]) {
    await sleep(wait)
    if (await tryPlay()) return 'playing'
  }

  return 'failed'
}

export const play = () => call('/me/player/play', { method: 'PUT' })
export const pause = () => call('/me/player/pause', { method: 'PUT' })
export const next = () => call('/me/player/next', { method: 'POST' })
export const previous = () => call('/me/player/previous', { method: 'POST' })
export const seek = (ms: number) =>
  call(`/me/player/seek?position_ms=${Math.max(0, Math.round(ms))}`, { method: 'PUT' })
