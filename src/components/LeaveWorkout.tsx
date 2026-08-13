import { createPortal } from 'react-dom'
import { ACCENT, BG, FG, LINE, LINE_STRONG, DwellButton, Label } from './ui'

/**
 * Asked when the back control is used mid-workout.
 *
 * Leaving is offered two ways on purpose. Half the time you are done and want
 * it counted; the other half you opened the wrong routine and want no trace of
 * it. Guessing wrong either loses a real session or puts a junk one on the
 * calendar, so the choice is explicit rather than inferred.
 */
export function LeaveWorkout({
  workoutName,
  sets,
  targetSets,
  volumeKg,
  onSave,
  onDiscard,
  onCancel,
}: {
  workoutName: string
  sets: number
  targetSets: number
  volumeKg: number
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}) {
  const nothingLogged = sets === 0

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(12,11,9,0.94)', zIndex: 195,
        display: 'grid', placeItems: 'center', animation: 'titleIn 260ms ease-out both',
      }}
    >
      <div style={{ width: 'min(760px, 92vw)', border: `1px solid ${LINE_STRONG}`, background: BG, padding: '38px 40px 34px' }}>
        <Label style={{ color: ACCENT, letterSpacing: '0.3em' }}>Leave workout</Label>
        <div
          className="font-display"
          style={{ fontWeight: 900, fontSize: 54, lineHeight: 0.9, textTransform: 'uppercase', marginTop: 10 }}
        >
          {workoutName}
        </div>

        <div style={{ display: 'flex', gap: 26, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${LINE}` }}>
          <div>
            <Label style={{ fontSize: 9 }}>Logged</Label>
            <div className="font-display" style={{ fontWeight: 800, fontSize: 34, lineHeight: 1, marginTop: 6 }}>
              {sets} <span style={{ font: "11px 'DM Mono', monospace", color: 'rgba(245,244,239,0.5)' }}>/ {targetSets} sets</span>
            </div>
          </div>
          <div>
            <Label style={{ fontSize: 9 }}>Volume</Label>
            <div className="font-display" style={{ fontWeight: 800, fontSize: 34, lineHeight: 1, marginTop: 6 }}>
              {volumeKg.toLocaleString()} <span style={{ font: "11px 'DM Mono', monospace", color: 'rgba(245,244,239,0.5)' }}>kg</span>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 14, color: 'rgba(245,244,239,0.55)', lineHeight: 1.6, marginTop: 18 }}>
          {nothingLogged
            ? 'Nothing is logged yet, so there is nothing to save.'
            : 'Saving puts this session under today on the calendar. Leaving without saving keeps no record of it.'}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 26, flexWrap: 'wrap' }}>
          {!nothingLogged && (
            <DwellButton
              ariaLabel="finish and save workout"
              active
              onConfirm={onSave}
              style={{ padding: '16px 26px', flex: 1, justifyContent: 'center' }}
            >
              Finish and save
            </DwellButton>
          )}
          <DwellButton
            ariaLabel="leave without saving"
            onConfirm={onDiscard}
            style={{ padding: '16px 26px', flex: 1, justifyContent: 'center', color: FG }}
          >
            Leave without saving
          </DwellButton>
          <DwellButton
            ariaLabel="keep training"
            onConfirm={onCancel}
            style={{ padding: '16px 26px', flex: 1, justifyContent: 'center' }}
          >
            Keep training
          </DwellButton>
        </div>
      </div>
    </div>,
    document.body,
  )
}
