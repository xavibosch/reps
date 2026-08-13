import { useEffect, useRef } from 'react'
import { ACCENT, FG, LINE, GestureTarget, Label, IconPause, IconPlay, IconPlus } from './ui'

/**
 * The timer counts in wall-clock time rather than by decrementing a counter on
 * an interval. setInterval drifts and is throttled hard in a background tab,
 * which for a rest timer means it silently under-counts while you look away.
 */
export function RestTimer({
  remaining,
  total,
  running,
  onToggle,
  onAdd,
}: {
  remaining: number
  total: number
  running: boolean
  onToggle: () => void
  onAdd: (sec: number) => void
}) {
  const beeped = useRef(false)

  useEffect(() => {
    if (remaining > 0) {
      beeped.current = false
      return
    }
    if (beeped.current || total === 0) return
    beeped.current = true
    // short tone at zero, so you can look away mid-set
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45)
      osc.connect(gain).connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.5)
      osc.onended = () => ctx.close()
    } catch {
      /* audio blocked before any user gesture: silent is fine */
    }
  }, [remaining, total])

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(Math.floor(remaining % 60)).padStart(2, '0')

  const R = 68
  const circ = 2 * Math.PI * R
  const drained = total > 0 ? 1 - remaining / total : 1
  const done = remaining <= 0 && total > 0

  return (
    <div style={{ borderBottom: `1px solid ${LINE}`, padding: '12px 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label>Rest Timer</Label>
        <Label style={{ color: done ? ACCENT : running ? ACCENT : 'rgba(245,244,239,0.4)' }}>
          {done ? 'Go' : running ? 'Counting' : 'Paused'}
        </Label>
      </div>

      {/* No progress ring: the countdown already says everything the ring did,
          and the ring only competed with the numerals for attention. */}
      <div style={{ textAlign: 'center' }}>
        <div
          className="font-display"
          style={{
            fontWeight: 800, fontSize: 82, lineHeight: 0.82, letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums', color: done ? ACCENT : FG,
          }}
        >
          {mm}:{ss}
        </div>
        <Label style={{ marginTop: 6 }}>Rest Between Sets</Label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <GestureTarget size={48} onConfirm={onToggle} ariaLabel="start pause timer">
          {running ? <IconPause s={20} c={ACCENT} /> : <IconPlay s={20} />}
        </GestureTarget>
        <GestureTarget size={42} onConfirm={() => onAdd(30)} ariaLabel="add 30 seconds">
          <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconPlus s={12} />
            <span style={{ font: "10px 'DM Mono', monospace" }}>30</span>
          </div>
        </GestureTarget>
      </div>
    </div>
  )
}
