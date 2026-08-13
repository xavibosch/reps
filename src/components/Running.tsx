import { useState } from 'react'
import { HandToggle } from './HandControl'
import { ACCENT, FG, LINE, LINE_STRONG, DwellButton, GestureTarget, IconChevronL, IconMinus, IconPlus, Label } from './ui'

/**
 * Manual entry for a run.
 *
 * Distance, time and pace are all editable, but they are not three independent
 * numbers: pace is time over distance. Letting all three be typed freely would
 * allow 5 km in 20 minutes at 6:00/km, which is simply wrong. So editing pace
 * moves time instead, and the three always agree.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const fmtTime = (s: number) => {
  const total = Math.round(s)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

const fmtPace = (secPerKm: number) =>
  Number.isFinite(secPerKm) && secPerKm > 0
    ? `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')}`
    : '—'

function Stat({
  label,
  value,
  unit,
  steps,
  onStep,
  disabled,
}: {
  label: string
  value: string
  unit: string
  /** Two sizes so a 10 km run is not fifty presses away from zero. */
  steps: [number, number]
  onStep: (delta: number) => void
  disabled?: boolean
}) {
  const [small, big] = steps
  return (
    <div style={{ flex: 1, border: `1px solid ${LINE}`, padding: '20px 22px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Label>{label}</Label>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="font-display" style={{ fontWeight: 800, fontSize: 68, lineHeight: 0.82, letterSpacing: '-0.02em' }}>
          {value}
        </span>
        <Label style={{ fontSize: 11 }}>{unit}</Label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4, opacity: disabled ? 0.35 : 1 }}>
        <GestureTarget size={46} ariaLabel={`${label} down a lot`} onConfirm={() => onStep(-big)} disabled={disabled}>
          <IconMinus s={18} />
        </GestureTarget>
        <GestureTarget size={40} ariaLabel={`${label} down`} onConfirm={() => onStep(-small)} disabled={disabled}>
          <IconMinus s={13} />
        </GestureTarget>
        <GestureTarget size={40} ariaLabel={`${label} up`} onConfirm={() => onStep(small)} disabled={disabled}>
          <IconPlus s={13} />
        </GestureTarget>
        <GestureTarget size={46} ariaLabel={`${label} up a lot`} onConfirm={() => onStep(big)} disabled={disabled}>
          <IconPlus s={18} />
        </GestureTarget>
      </div>
    </div>
  )
}

export function Running({
  onSave,
  onBack,
  handOn,
  onToggleHand,
}: {
  onSave: (run: { km: number; seconds: number }) => void
  onBack: () => void
  handOn: boolean
  onToggleHand: () => void
}) {
  const [km, setKm] = useState(5)
  const [seconds, setSeconds] = useState(30 * 60)

  const paceSec = km > 0 ? seconds / km : 0

  // editing pace holds the distance and moves the clock, which is the only
  // way to keep all three consistent
  const stepPace = (delta: number) => {
    if (km <= 0) return
    setSeconds((s) => clamp(Math.round(s + delta * km), 60, 24 * 3600))
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '40px 56px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <Label style={{ color: ACCENT, letterSpacing: '0.3em' }}>Log a run</Label>
          <div
            className="font-display"
            style={{ fontWeight: 900, fontSize: 84, lineHeight: 0.86, textTransform: 'uppercase', marginTop: 10 }}
          >
            Running
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DwellButton ariaLabel="back to home from running" onConfirm={onBack}>
            <IconChevronL s={13} />
            Back
          </DwellButton>
          <HandToggle on={handOn} onToggle={onToggleHand} />
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <Stat
            label="Distance"
            value={km.toFixed(1)}
            unit="km"
            steps={[0.1, 1]}
            onStep={(d) => setKm((v) => clamp(Math.round((v + d) * 10) / 10, 0, 300))}
          />
          <Stat
            label="Time"
            value={fmtTime(seconds)}
            unit={seconds >= 3600 ? 'h:mm:ss' : 'min'}
            steps={[15, 300]}
            onStep={(d) => setSeconds((v) => clamp(v + d, 60, 24 * 3600))}
          />
          <Stat
            label="Pace"
            value={fmtPace(paceSec)}
            unit="/ km"
            steps={[5, 30]}
            onStep={stepPace}
            disabled={km <= 0}
          />
        </div>

        <div style={{ fontSize: 13, color: 'rgba(245,244,239,0.45)', marginTop: 16, lineHeight: 1.6 }}>
          Pace follows distance and time. Change it and the clock moves with it, so the three never disagree.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        <Label style={{ fontSize: 9, color: 'rgba(245,244,239,0.35)' }}>
          Saved to the log under today, same as a lifting session
        </Label>
        <DwellButton
          ariaLabel="save run"
          active
          onConfirm={() => onSave({ km, seconds })}
          style={{ padding: '18px 34px', borderColor: ACCENT, color: FG }}
        >
          Save run
        </DwellButton>
      </div>

      <div style={{ borderTop: `1px solid ${LINE_STRONG}`, marginTop: 18 }} />
    </div>
  )
}
