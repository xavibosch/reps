import { useEffect, useRef, useState } from 'react'
import * as sp from '../lib/spotify'
import { Coverflow } from './Coverflow'
import { PlaylistPicker } from './PlaylistPicker'
import {
  ACCENT, FG, LINE, LINE_STRONG, GestureTarget, Label,
  IconPause, IconPlay, IconSkip, IconVolDown, IconVolUp, IconList,
} from './ui'

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** ?demo=1 renders the playing layout without Spotify, for checking spacing. */
const DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo') === '1'
const DEMO_STATE: sp.NowPlaying = {
  trackId: 'demo', title: 'The Emptiness Machine', artist: 'Linkin Park', album: 'From Zero',
  art: 'https://i.scdn.co/image/ab67616d0000b273c3c2a0f2f1f0d1d8b4b4b4b4',
  isPlaying: true, progressMs: 74_000, durationMs: 190_000, deviceName: 'MacBook Pro', volume: 62,
}

export function SpotifyPanel({ onTrackChange }: { onTrackChange?: (artist: string, art?: string) => void }) {
  const trackCb = useRef(onTrackChange)
  trackCb.current = onTrackChange
  const [state, setState] = useState<sp.NowPlaying | 'no-device' | null>(DEMO ? DEMO_STATE : null)
  const [connected, setConnected] = useState(DEMO || sp.isConnected())
  const [clientId, setClientIdInput] = useState(sp.getClientId())
  const [err, setErr] = useState<string | null>(null)
  const [upcoming, setUpcoming] = useState<sp.QueueTrack[]>([])
  const [recent, setRecent] = useState<sp.QueueTrack[]>([])
  /** Local echo so the UI reacts instantly instead of waiting for the poll. */
  const optimistic = useRef<{ until: number; isPlaying: boolean } | null>(null)
  /** Queue and history are only refetched when the track actually changes. */
  const lastTrackKey = useRef('')
  const [showPlaylists, setShowPlaylists] = useState(false)
  const [playlists, setPlaylists] = useState<sp.Playlist[]>([])
  /** Same trick as play/pause: hold the nudged value until the device catches up. */
  const volumeEcho = useRef<{ until: number; value: number } | null>(null)

  useEffect(() => {
    sp.handleRedirect()
      .then((did) => did && setConnected(true))
      .catch((e) => setErr(String(e.message || e)))
  }, [])

  useEffect(() => {
    if (!connected || DEMO) return
    let alive = true

    const poll = async () => {
      if (document.hidden) return
      try {
        const s = await sp.getNowPlaying()
        if (!alive) return
        if (s === null) {
          setConnected(false)
          return
        }
        // let an optimistic play/pause stand briefly, so the button never flickers back
        if (s === 'no-device') {
          setState(s)
        } else {
          const patched = { ...s }
          if (optimistic.current && Date.now() < optimistic.current.until) {
            patched.isPlaying = optimistic.current.isPlaying
          }
          if (volumeEcho.current && Date.now() < volumeEcho.current.until) {
            patched.volume = volumeEcho.current.value
          }
          setState(patched)
        }

        if (s !== 'no-device') {
          const key = s.trackId
          if (key !== lastTrackKey.current) {
            lastTrackKey.current = key
            // report the change upward so the session can tally artists
            trackCb.current?.(s.artist, s.art)
            sp.getQueue().then((q) => alive && setUpcoming(q)).catch(() => {})
            sp.getRecent().then((r) => alive && setRecent(r)).catch(() => {})
          }
        }
      } catch {
        /* transient network error: keep the last known state */
      }
    }

    poll()
    const id = setInterval(poll, 1000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [connected])

  /* ── not configured yet ── */
  if (!connected) {
    return (
      <div style={{ borderBottom: `1px solid ${LINE}`, padding: '18px 30px', display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label>Now Playing · Spotify</Label>
          <Label style={{ color: 'rgba(245,244,239,0.4)' }}>Offline</Label>
        </div>
        <Label style={{ lineHeight: 1.7, letterSpacing: '0.1em', textTransform: 'none', fontSize: 11 }}>
          Paste your Spotify app client id, then connect. Redirect URI must be exactly{' '}
          <span style={{ color: ACCENT }}>{sp.redirectUri()}</span>
        </Label>
        <input
          value={clientId}
          onChange={(e) => setClientIdInput(e.target.value)}
          placeholder="client id"
          style={{ background: 'transparent', border: `1px solid ${LINE_STRONG}`, color: FG, font: "13px 'DM Mono', monospace", padding: '10px 12px', outline: 'none' }}
        />
        <button
          onPointerDown={() => {
            sp.setClientId(clientId)
            sp.login().catch((e) => setErr(String(e.message || e)))
          }}
          disabled={!clientId.trim()}
          style={{
            border: `1px solid ${ACCENT}`, background: 'rgba(214,48,34,0.12)', color: FG,
            font: "11px 'DM Mono', monospace", letterSpacing: '0.22em', textTransform: 'uppercase',
            padding: '12px', cursor: 'default', opacity: clientId.trim() ? 1 : 0.4,
          }}
        >
          Connect Spotify
        </button>
        {err && <Label style={{ color: ACCENT, textTransform: 'none', letterSpacing: '0.05em' }}>{err}</Label>}
      </div>
    )
  }

  /* ── connected, but nothing playing ── */
  if (state === 'no-device' || !state) {
    return (
      <div style={{ borderBottom: `1px solid ${LINE}`, padding: '18px 30px', display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label>Now Playing · Spotify</Label>
          <Label style={{ color: 'rgba(245,244,239,0.4)' }}>No device</Label>
        </div>
        <Label style={{ lineHeight: 1.7, textTransform: 'none', letterSpacing: '0.08em', fontSize: 11 }}>
          Connected. Start playing something in the Spotify app on your Mac or phone and it appears here.
        </Label>
        <button
          onPointerDown={() => { sp.logout(); setConnected(false) }}
          style={{ border: `1px solid ${LINE_STRONG}`, background: 'transparent', color: 'rgba(245,244,239,0.6)', font: "10px 'DM Mono', monospace", letterSpacing: '0.2em', textTransform: 'uppercase', padding: '9px', cursor: 'default' }}
        >
          Disconnect
        </button>
      </div>
    )
  }

  /* ── playing ── */
  const pct = state.durationMs ? (state.progressMs / state.durationMs) * 100 : 0

  const toggle = () => {
    const nextPlaying = !state.isPlaying
    optimistic.current = { until: Date.now() + 1800, isPlaying: nextPlaying }
    setState({ ...state, isPlaying: nextPlaying })
    ;(nextPlaying ? sp.play() : sp.pause())?.catch?.(() => {})
  }

  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const ms = ratio * state.durationMs
    setState({ ...state, progressMs: ms })
    sp.seek(ms)
  }

  /** Volume echoes locally first: the device round trip is far slower than a nudge. */
  const nudgeVolume = (delta: number) => {
    if (state.volume == null) return
    const next = Math.min(100, Math.max(0, state.volume + delta))
    setState({ ...state, volume: next })
    volumeEcho.current = { until: Date.now() + 2500, value: next }
    sp.setVolume(next)
  }

  return (
    <div style={{ borderBottom: `1px solid ${LINE}`, padding: '14px 26px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label>Now Playing · Spotify</Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* dwell, not click: the hand cursor must be able to open this too */}
          <GestureTarget
            size={38}
            onConfirm={() => { setShowPlaylists(true); sp.getPlaylists().then(setPlaylists).catch(() => {}) }}
            ariaLabel="open playlists"
          >
            <IconList s={15} />
          </GestureTarget>
          <Label style={{ color: state.isPlaying ? ACCENT : 'rgba(245,244,239,0.4)' }}>
            {state.isPlaying ? '● Live' : 'Paused'}
          </Label>
        </div>
      </div>

      {/* fanned coverflow: history on the left, queue on the right */}
      <Coverflow
        recent={recent}
        upcoming={upcoming.length ? upcoming : [{ id: state.trackId, title: state.title, artist: state.artist, art: state.art }]}
        size={196}
      />

      {/* keyed by track so the entrance animation replays on every song change */}
      <div key={state.trackId} style={{ textAlign: 'center', minWidth: 0, animation: 'titleIn 420ms ease-out both' }}>
        <div
          className="font-display"
          style={{
            fontWeight: 800, fontSize: 36, lineHeight: 0.92, textTransform: 'uppercase',
            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}
        >
          {state.title}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(245,244,239,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {state.artist}
        </div>
      </div>

      {/* scrub bar */}
      <div>
        <div
          onPointerDown={scrub}
          style={{ position: 'relative', height: 18, display: 'flex', alignItems: 'center', cursor: 'default', touchAction: 'none' }}
        >
          <div style={{ position: 'relative', height: 2, background: LINE_STRONG, width: '100%' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: 2, width: `${pct}%`, background: ACCENT }} />
            <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 13, height: 13, borderRadius: '50%', background: FG, border: `1px solid ${ACCENT}` }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <Label style={{ fontSize: 9 }}>{fmt(state.progressMs)}</Label>
          <Label style={{ fontSize: 9 }}>{fmt(state.durationMs)}</Label>
        </div>
      </div>

      {/* volume flanks the transport: minus, prev, play, next, plus */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <GestureTarget size={46} onConfirm={() => nudgeVolume(-10)} ariaLabel="volume down" disabled={state.volume == null}>
          <IconVolDown />
        </GestureTarget>
        <GestureTarget size={52} onConfirm={() => sp.previous()} ariaLabel="previous track"><IconSkip flip /></GestureTarget>
        <GestureTarget size={66} onConfirm={toggle} ariaLabel="play pause">
          {state.isPlaying ? <IconPause s={26} /> : <IconPlay s={26} />}
        </GestureTarget>
        <GestureTarget size={52} onConfirm={() => sp.next()} ariaLabel="next track"><IconSkip /></GestureTarget>
        <GestureTarget size={46} onConfirm={() => nudgeVolume(10)} ariaLabel="volume up" disabled={state.volume == null}>
          <IconVolUp />
        </GestureTarget>
      </div>

      {/* volume readout, only when the device reports one */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
        {state.volume == null ? (
          <Label style={{ fontSize: 9, color: 'rgba(245,244,239,0.35)' }}>This device has no volume control</Label>
        ) : (
          <>
            <Label style={{ fontSize: 9 }}>Vol</Label>
            <div style={{ width: 120, height: 2, background: LINE_STRONG, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: 2, width: `${state.volume}%`, background: ACCENT, transition: 'width 200ms' }} />
            </div>
            <Label style={{ fontSize: 9, width: 26 }}>{state.volume}</Label>
          </>
        )}
      </div>

      {showPlaylists && (
        <PlaylistPicker
          playlists={playlists}
          onPick={(uri) => { sp.playContext(uri); setShowPlaylists(false) }}
          onClose={() => setShowPlaylists(false)}
        />
      )}
    </div>
  )
}
