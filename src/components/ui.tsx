import { useEffect, useRef, useState, type CSSProperties, type DragEventHandler, type ReactNode } from 'react'

export const BG = '#0c0b09'
export const FG = '#f5f4ef'
export const ACCENT = '#d63022'
export const LINE = 'rgba(245, 244, 239, 0.12)'
export const LINE_STRONG = 'rgba(245, 244, 239, 0.20)'
export const HOLD_MS = 620

/* ───────────────── hold-to-confirm (dwell) ───────────────── */
/**
 * Every control is dwell-activated rather than click-activated: hold, and a
 * ring fills before the action fires. That is what makes the same UI drivable
 * by a hand-tracking cursor later, where there is no "click" event at all.
 * A quick tap still works as a shortcut so a mouse stays usable today.
 */
function useDwell(onConfirm: () => void) {
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const raf = useRef(0)
  const start = useRef(0)
  const fired = useRef(false)
  const cb = useRef(onConfirm)
  cb.current = onConfirm

  const cancel = () => {
    setHolding(false)
    setProgress(0)
    start.current = 0
    cancelAnimationFrame(raf.current)
  }

  const tick = (t: number) => {
    if (!start.current) start.current = t
    const p = Math.min(1, (t - start.current) / HOLD_MS)
    setProgress(p)
    if (p >= 1) {
      fired.current = true
      cb.current()
      cancel()
      return
    }
    raf.current = requestAnimationFrame(tick)
  }

  const begin = () => {
    fired.current = false
    setHolding(true)
    start.current = 0
    raf.current = requestAnimationFrame(tick)
  }

  const release = () => {
    // a short tap counts too, so the app is usable with a mouse right now
    if (!fired.current) cb.current()
    cancel()
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return {
    progress,
    holding,
    handlers: {
      onPointerDown: begin,
      onPointerUp: release,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
    },
  }
}

export function GestureTarget({
  size = 64,
  onConfirm,
  children,
  stroke = 2,
  ariaLabel,
  tone = 'default',
  disabled,
}: {
  size?: number
  onConfirm: () => void
  children: ReactNode
  stroke?: number
  ariaLabel: string
  tone?: 'default' | 'accent'
  disabled?: boolean
}) {
  const { progress, holding, handlers } = useDwell(onConfirm)
  const r = size / 2 - stroke
  const circ = 2 * Math.PI * r
  const accent = tone === 'accent'

  return (
    <button
      aria-label={ariaLabel}
      disabled={disabled}
      {...(disabled ? {} : handlers)}
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
        borderRadius: '50%',
        border: `1px solid ${holding || accent ? ACCENT : LINE_STRONG}`,
        background: holding ? 'rgba(214,48,34,0.14)' : accent ? 'rgba(214,48,34,0.08)' : 'transparent',
        color: FG,
        cursor: 'default',
        outline: 'none',
        opacity: disabled ? 0.3 : 1,
        transition: 'transform 120ms ease, border-color 120ms, background 120ms, box-shadow 120ms',
        transform: holding ? 'scale(1.05)' : 'scale(1)',
        boxShadow: holding ? `0 0 0 1px ${ACCENT}, 0 0 22px rgba(214,48,34,0.28)` : 'none',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'none',
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ACCENT}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
          strokeLinecap="butt"
          style={{ opacity: progress > 0 ? 1 : 0 }}
        />
      </svg>
      <span style={{ display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>{children}</span>
    </button>
  )
}

/**
 * Rectangular hold-to-confirm region, for things that are not round buttons:
 * the playlist tiles and the playlist opener. Same dwell contract as
 * GestureTarget so the hand cursor drives it identically, but the feedback is
 * a sweeping bar rather than a ring.
 */
export function DwellArea({
  children,
  onConfirm,
  ariaLabel,
  style,
  activeBorder = true,
  onDragOver,
  onDrop,
}: {
  children: ReactNode
  onConfirm: () => void
  ariaLabel: string
  style?: CSSProperties
  activeBorder?: boolean
  onDragOver?: DragEventHandler<HTMLButtonElement>
  onDrop?: DragEventHandler<HTMLButtonElement>
}) {
  const { progress, holding, handlers } = useDwell(onConfirm)

  return (
    <button
      aria-label={ariaLabel}
      onDragOver={onDragOver}
      onDrop={onDrop}
      {...handlers}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'transparent',
        color: FG,
        cursor: 'default',
        outline: 'none',
        padding: 0,
        textAlign: 'left',
        border: `1px solid ${holding && activeBorder ? ACCENT : LINE}`,
        transition: 'border-color 120ms, transform 120ms',
        transform: holding ? 'scale(1.02)' : 'scale(1)',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'none',
        ...style,
      }}
    >
      {children}
      {/* fill sweeps left to right while the hold builds */}
      <span
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 3,
          width: `${progress * 100}%`,
          background: ACCENT,
          opacity: progress > 0 ? 1 : 0,
          pointerEvents: 'none',
        }}
      />
    </button>
  )
}

/**
 * Text button with the same dwell contract as everything else.
 *
 * Plain buttons are unusable under hand control: the cursor dispatches a
 * pointerdown the instant it crosses one, so merely passing over "Edit" opened
 * the editor. Every control the hand can reach has to require a hold.
 */
export function DwellButton({
  children,
  onConfirm,
  ariaLabel,
  active,
  style,
}: {
  children: ReactNode
  onConfirm: () => void
  ariaLabel: string
  active?: boolean
  style?: CSSProperties
}) {
  return (
    <DwellArea
      ariaLabel={ariaLabel}
      onConfirm={onConfirm}
      style={{
        border: `1px solid ${active ? ACCENT : LINE_STRONG}`,
        background: active ? 'rgba(214,48,34,0.12)' : 'transparent',
        font: "10px 'DM Mono', monospace",
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        padding: '7px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        ...style,
      }}
    >
      {children}
    </DwellArea>
  )
}

export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="label" style={style}>
      {children}
    </span>
  )
}

/* ───────────────────────── icons ───────────────────────── */
const ic = {
  stroke: FG,
  strokeWidth: 1.6,
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const IconChevronR = ({ s = 22 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...ic}><path d="M9 5l7 7-7 7" /></svg>
)
export const IconChevronL = ({ s = 22 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...ic}><path d="M15 5l-7 7 7 7" /></svg>
)
export const IconPlay = ({ s = 22 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={FG} stroke="none"><path d="M8 5v14l11-7z" /></svg>
)
export const IconPause = ({ s = 22, c = FG }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none">
    <rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" />
  </svg>
)
export const IconSkip = ({ s = 20, flip = false }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={FG} stroke="none" style={{ transform: flip ? 'scaleX(-1)' : 'none' }}>
    <path d="M6 5v14l9-7zM17 5h2v14h-2z" />
  </svg>
)
export const IconPlus = ({ s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...ic}><path d="M12 6v12M6 12h12" /></svg>
)
export const IconMinus = ({ s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...ic}><path d="M6 12h12" /></svg>
)
export const IconCheck = ({ s = 26, c = FG }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12.5l5.5 5.5L20 7" />
  </svg>
)
export const IconEdit = ({ s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...ic}><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></svg>
)
export const IconList = ({ s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...ic}><path d="M4 6h16M4 12h16M4 18h10" /></svg>
)
export const IconCalendar = ({ s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...ic}>
    <path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4" />
  </svg>
)
export const IconX = ({ s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...ic}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const IconUpload = ({ s = 22 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...ic}>
    <path d="M12 16V4M8 8l4-4 4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
  </svg>
)
export const IconVolUp = ({ s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...ic}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <path d="M17 8.5a5 5 0 010 7M19.5 6a8.5 8.5 0 010 12" />
  </svg>
)
export const IconVolDown = ({ s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...ic}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <path d="M17 10.5a3.5 3.5 0 010 3" />
  </svg>
)
export const IconTrash = ({ s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...ic}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </svg>
)

/* ───────────────────────── overlay shell ───────────────────────── */
export function Overlay({
  title,
  onClose,
  children,
  width = 860,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      data-overlay=""
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(6,5,4,0.82)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          width,
          maxHeight: 760,
          background: BG,
          border: `1px solid ${LINE_STRONG}`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 30px 90px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 22px',
            borderBottom: `1px solid ${LINE}`,
          }}
        >
          <Label style={{ color: FG, letterSpacing: '0.28em' }}>{title}</Label>
          <GestureTarget size={40} onConfirm={onClose} ariaLabel="close">
            <IconX s={18} />
          </GestureTarget>
        </div>
        <div style={{ padding: '20px 22px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}

/** Plain text/number field styled to the system. */
export function Field({
  label,
  value,
  onChange,
  type = 'text',
  width,
}: {
  label: string
  value: string | number
  onChange: (v: string) => void
  type?: 'text' | 'number'
  width?: number | string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, width }}>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'transparent',
          border: `1px solid ${LINE_STRONG}`,
          color: FG,
          font: "14px 'DM Mono', monospace",
          padding: '10px 12px',
          outline: 'none',
          width: '100%',
        }}
      />
    </label>
  )
}
