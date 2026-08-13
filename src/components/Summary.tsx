import { createPortal } from 'react-dom'
import { ACCENT, BG, FG, LINE, LINE_STRONG, DwellButton, Label } from './ui'

export type SummaryData = {
  workoutName: string
  volumeKg: number
  seconds: number
  sets: number
  targetSets: number
  exercisesDone: number
  muscles: string[]
  topArtist?: { name: string; plays: number; art?: string }
}

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/**
 * End of workout screen. Portalled to <body> for the same reason the hand
 * cursor is: the app frame is scaled by a transform, and anything fixed inside
 * it would be laid out in the frame's local space instead of the viewport.
 */
export function Summary({ data, onClose }: { data: SummaryData; onClose: () => void }) {
  const stat = (label: string, value: string, unit?: string) => (
    <div style={{ padding: '20px 24px', borderRight: `1px solid ${LINE}`, flex: 1 }}>
      <Label style={{ fontSize: 9 }}>{label}</Label>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
        <span className="font-display" style={{ fontWeight: 800, fontSize: 62, lineHeight: 0.82, letterSpacing: '-0.02em' }}>
          {value}
        </span>
        {unit && <Label style={{ fontSize: 10 }}>{unit}</Label>}
      </div>
    </div>
  )

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, background: BG, zIndex: 200,
        display: 'grid', placeItems: 'center', animation: 'titleIn 420ms ease-out both',
      }}
    >
      <div style={{ width: 'min(1100px, 92vw)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: `1px solid ${LINE_STRONG}`, paddingBottom: 16 }}>
          <div>
            <Label style={{ color: ACCENT, letterSpacing: '0.3em' }}>Workout complete</Label>
            <div className="font-display" style={{ fontWeight: 900, fontSize: 84, lineHeight: 0.86, textTransform: 'uppercase', marginTop: 10 }}>
              {data.workoutName}
            </div>
          </div>
          <Label>{data.exercisesDone} exercises</Label>
        </div>

        <div style={{ display: 'flex', borderBottom: `1px solid ${LINE}` }}>
          {stat('Total volume', data.volumeKg.toLocaleString(), 'kg')}
          {stat('Total time', mmss(data.seconds), 'min')}
          {stat('Sets', String(data.sets), `/ ${data.targetSets}`)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 30, paddingTop: 26 }}>
          <div>
            <Label style={{ fontSize: 9 }}>Worked</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {data.muscles.length === 0 ? (
                <Label style={{ color: 'rgba(245,244,239,0.4)' }}>Nothing logged</Label>
              ) : (
                data.muscles.map((m) => (
                  <span
                    key={m}
                    style={{
                      font: "10px 'DM Mono', monospace", letterSpacing: '0.14em', textTransform: 'uppercase',
                      padding: '7px 12px', border: `1px solid ${LINE_STRONG}`, color: 'rgba(245,244,239,0.75)',
                    }}
                  >
                    {m}
                  </span>
                ))
              )}
            </div>
          </div>

          <div>
            <Label style={{ fontSize: 9 }}>Most played</Label>
            {data.topArtist ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
                <div style={{ width: 68, height: 68, flexShrink: 0, border: `1px solid ${ACCENT}`, background: '#161310' }}>
                  {data.topArtist.art && (
                    <img src={data.topArtist.art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    className="font-display"
                    style={{ fontWeight: 800, fontSize: 28, lineHeight: 1, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {data.topArtist.name}
                  </div>
                  <Label style={{ marginTop: 6, display: 'block', color: ACCENT }}>
                    {data.topArtist.plays} track{data.topArtist.plays === 1 ? '' : 's'}
                  </Label>
                </div>
              </div>
            ) : (
              <Label style={{ display: 'block', marginTop: 12, color: 'rgba(245,244,239,0.4)' }}>
                No music tracked
              </Label>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 34 }}>
          <DwellButton ariaLabel="finish workout" active onConfirm={onClose} style={{ padding: '16px 28px', justifyContent: 'center' }}>
            Done
          </DwellButton>
        </div>
      </div>
    </div>,
    document.body,
  )
}
