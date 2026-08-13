import { useMediaUrl } from '../lib/store'
import type { Workout } from '../types'
import { HandToggle } from './HandControl'
import { ACCENT, FG, LINE, LINE_STRONG, DwellArea, DwellButton, IconCalendar, Label } from './ui'

/**
 * Launch screen. Picking a workout here is what starts everything: the session
 * clock, the exercise queue and the music, so a set never begins with the user
 * hunting for a play button.
 */
export function Home({
  workouts,
  onStart,
  handOn,
  onToggleHand,
  handNote,
  musicNote,
  onOpenHistory,
  onStartRun,
  sessionCount,
  lastSession,
}: {
  workouts: Workout[]
  onStart: (workoutId: string) => void
  handOn: boolean
  onToggleHand: () => void
  handNote?: string | null
  musicNote?: string | null
  onOpenHistory: () => void
  onStartRun: () => void
  sessionCount: number
  lastSession?: { workoutName: string; day: string; volumeKg: number; run?: { km: number } } | null
}) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '46px 56px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <Label style={{ color: ACCENT, letterSpacing: '0.3em' }}>Welcome back</Label>
          <div
            className="font-display"
            style={{ fontWeight: 900, fontSize: 92, lineHeight: 0.86, textTransform: 'uppercase', marginTop: 12 }}
          >
            Mr Bosch
          </div>
          <div style={{ fontSize: 15, color: 'rgba(245,244,239,0.6)', marginTop: 16, maxWidth: 560, lineHeight: 1.6 }}>
            Let&apos;s work out. You are the best. Keep the focus and complete the session.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <DwellButton ariaLabel="open training log" onConfirm={onOpenHistory}>
              <IconCalendar s={13} />
              Log
              {sessionCount > 0 && (
                <span style={{ color: ACCENT, font: "10px 'DM Mono', monospace" }}>{sessionCount}</span>
              )}
            </DwellButton>
            <HandToggle on={handOn} onToggle={onToggleHand} />
          </div>
          {/* When tracking turns itself off, say why: an unexplained toggle
              flipping back looks like the feature is simply broken. */}
          <Label
            style={{
              fontSize: 9,
              color: handNote ? ACCENT : 'rgba(245,244,239,0.4)',
              maxWidth: 220,
              textAlign: 'right',
              lineHeight: 1.5,
            }}
          >
            {handNote ?? (handOn ? 'point and hold to pick' : 'hand control off')}
          </Label>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Label>Choose today&apos;s session</Label>
          <Label style={{ color: 'rgba(245,244,239,0.35)' }}>
            {musicNote ?? 'starts the clock and the music'}
          </Label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
          {workouts.map((w, i) => (
            <WorkoutCard key={w.id} workout={w} index={i} onStart={() => onStart(w.id)} />
          ))}
        </div>

        {/* Running is a different kind of session, not a fifth routine, so it
            gets a bar under the row rather than a card in it. */}
        <DwellArea
          ariaLabel="log a run"
          onConfirm={onStartRun}
          style={{
            marginTop: 18, height: 58, background: '#141310',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 20px',
          }}
        >
          <div
            className="font-display"
            style={{ fontWeight: 800, fontSize: 24, lineHeight: 1, textTransform: 'uppercase', color: FG }}
          >
            Running
          </div>
          <span style={{ width: 7, height: 7, background: ACCENT, borderRadius: '50%' }} />
        </DwellArea>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
        {lastSession ? (
          <Label style={{ fontSize: 9, color: 'rgba(245,244,239,0.5)' }}>
            Last · {lastSession.workoutName} · {lastSession.day} ·{' '}
            {lastSession.run ? `${lastSession.run.km.toFixed(1)} km` : `${lastSession.volumeKg.toLocaleString()} kg`}
          </Label>
        ) : (
          <Label style={{ fontSize: 9, color: 'rgba(245,244,239,0.3)' }}>No sessions logged yet</Label>
        )}
        <Label style={{ fontSize: 9, color: 'rgba(245,244,239,0.3)' }}>
          Space done · arrows move · R rest · W workouts · E exercises
        </Label>
      </div>
    </div>
  )
}

function WorkoutCard({ workout, index, onStart }: { workout: Workout; index: number; onStart: () => void }) {
  // the first exercise's demo doubles as the card's artwork, held on one frame
  const first = workout.exercises[0]
  const art = useMediaUrl(first?.mediaId, first?.gifUrl) ?? first?.frames?.[0]
  const sets = workout.exercises.reduce((n, e) => n + e.sets, 0)

  return (
    <DwellArea
      ariaLabel={`start ${workout.name}`}
      onConfirm={onStart}
      style={{ display: 'flex', flexDirection: 'column', background: '#141310', height: 320 }}
    >
      <div style={{ position: 'relative', height: 176, background: '#161310', borderBottom: `1px solid ${LINE_STRONG}`, overflow: 'hidden' }}>
        {art ? (
          <img src={art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(0.4)' }} />
        ) : (
          <span
            className="font-display"
            style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              fontWeight: 900, fontSize: 64, color: 'rgba(245,244,239,0.09)',
            }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
        )}
        <span style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(12,11,9,0.75)', border: `1px solid ${LINE}`, padding: '4px 8px' }}>
          <Label style={{ fontSize: 9 }}>{String(index + 1).padStart(2, '0')}</Label>
        </span>
      </div>

      <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div
          className="font-display"
          style={{ fontWeight: 800, fontSize: 26, lineHeight: 1.02, textTransform: 'uppercase', color: FG }}
        >
          {workout.name}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', gap: 14 }}>
          <Label style={{ fontSize: 9 }}>{workout.exercises.length} ex</Label>
          <Label style={{ fontSize: 9, color: ACCENT }}>{sets} sets</Label>
        </div>
      </div>
    </DwellArea>
  )
}
