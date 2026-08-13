import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Progress, Workout } from './types'
import { useFrameCycle, useMediaUrl, useWorkouts } from './lib/store'
import { SpotifyPanel } from './components/SpotifyPanel'
import { RestTimer } from './components/RestTimer'
import { ExerciseEditor, WorkoutPicker } from './components/Editors'
import { HandControl, HandToggle } from './components/HandControl'
import { Home } from './components/Home'
import { History } from './components/History'
import { LeaveWorkout } from './components/LeaveWorkout'
import { appendRun, appendSession, useHistory } from './lib/history'
import { Running } from './components/Running'
import * as sp from './lib/spotify'
import { Summary, type SummaryData } from './components/Summary'
import {
  ACCENT, BG, FG, LINE, LINE_STRONG,
  GestureTarget, DwellArea, DwellButton, Label,
  IconCheck, IconChevronL, IconChevronR, IconEdit, IconList, IconMinus, IconPause, IconPlay, IconPlus,
} from './components/ui'

/* ───────────────── stat block ───────────────── */
function StatBlock({
  label, value, unit, onInc, onDec,
}: {
  label: string
  value: number
  unit?: string
  onInc: () => void
  onDec: () => void
}) {
  return (
    <div style={{ flex: 1, border: `1px solid ${LINE}`, padding: '12px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Label>{label}</Label>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
        <span className="font-display" style={{ fontWeight: 800, fontSize: 60, lineHeight: 0.82, letterSpacing: '-0.01em' }}>{value}</span>
        {unit && <Label style={{ marginBottom: 8, fontSize: 11 }}>{unit}</Label>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <GestureTarget size={42} onConfirm={onDec} ariaLabel={`decrease ${label}`}><IconMinus s={16} /></GestureTarget>
        <GestureTarget size={42} onConfirm={onInc} ariaLabel={`increase ${label}`}><IconPlus s={16} /></GestureTarget>
      </div>
    </div>
  )
}

/* ───────────────── exercise cover ───────────────── */
function Cover({
  mediaId, gifUrl, frames, name, onEdit,
}: {
  mediaId?: string
  gifUrl?: string
  frames?: string[]
  name: string
  onEdit: () => void
}) {
  const uploaded = useMediaUrl(mediaId, gifUrl)
  const frame = useFrameCycle(frames)
  // anything the user uploaded outranks the demo that shipped with the app
  const url = uploaded ?? frame
  const isVideo = url?.startsWith('blob:') && mediaId?.endsWith('.mp4')

  return (
    <DwellArea
      ariaLabel={`edit ${name}`}
      onConfirm={onEdit}
      style={{ position: 'relative', width: 300, height: 300, border: `1px solid ${LINE_STRONG}`, background: '#161310' }}
    >
      {url ? (
        isVideo ? (
          <video src={url} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <img src={url} alt={`${name} demonstration`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', gap: 8 }}>
          <div>
            <Label style={{ display: 'block', color: 'rgba(245,244,239,0.45)' }}>No demo yet</Label>
            <Label style={{ display: 'block', marginTop: 6, fontSize: 9, color: ACCENT }}>Tap to upload a GIF</Label>
          </div>
        </div>
      )}
      <div style={{ position: 'absolute', top: 10, left: 10, display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(12,11,9,0.72)', border: `1px solid ${LINE}`, padding: '5px 9px' }}>
        <span style={{ width: 6, height: 6, background: ACCENT, borderRadius: '50%' }} />
        <Label style={{ fontSize: 9, letterSpacing: '0.24em' }}>{url ? 'Loop · Demo' : 'Empty'}</Label>
      </div>
      <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(12,11,9,0.72)', border: `1px solid ${LINE}`, padding: '6px 8px', color: 'rgba(245,244,239,0.7)' }}>
        <IconEdit s={13} />
      </div>
      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 -60px 60px -40px rgba(12,11,9,0.9)', pointerEvents: 'none' }} />
    </DwellArea>
  )
}

/* ═══════════════════════ app ═══════════════════════ */
export default function App() {
  const [workouts, setWorkouts] = useWorkouts()
  const [workoutId, setWorkoutId] = useState(workouts[0]?.id ?? '')
  const workout: Workout = workouts.find((w) => w.id === workoutId) ?? workouts[0]

  const [active, setActive] = useState(0)
  const [progress, setProgress] = useState<Progress>({})
  const [showWorkouts, setShowWorkouts] = useState(false)
  const [showExercises, setShowExercises] = useState(false)
  /* The session clock only runs once you start it: opening the page hours
     before training should not report a two hour workout. */
  const [sessionRunning, setSessionRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const sessionStart = useRef(0)
  /** Artist play counts for this session, fed by the Spotify panel. */
  const [artists, setArtists] = useState<Record<string, { plays: number; art?: string }>>({})
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [history, refreshHistory] = useHistory()
  const [showHistory, setShowHistory] = useState(false)
  const [showLeave, setShowLeave] = useState(false)
  /* The app opens on the launcher, not mid-session. */
  const [screen, setScreen] = useState<'home' | 'session' | 'running'>('home')
  /* Hand control is the intended way to drive this, so it starts on. */
  const [handOn, setHandOn] = useState(true)
  /** Why tracking switched itself off, so the toggle never flips silently. */
  const [handNote, setHandNote] = useState<string | null>(null)
  const [musicNote, setMusicNote] = useState<string | null>(null)

  const toggleHand = () => {
    setHandNote(null)
    setHandOn((v) => !v)
  }

  const exercises = workout?.exercises ?? []
  const ex = exercises[Math.min(active, Math.max(0, exercises.length - 1))]
  const doneSets = ex ? progress[ex.id] ?? 0 : 0

  /* ── rest timer, driven by wall clock so it cannot drift ── */
  const [total, setTotal] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [running, setRunning] = useState(false)
  const endsAt = useRef(0)

  useEffect(() => {
    if (!running) return
    const tick = () => setRemaining(Math.max(0, (endsAt.current - Date.now()) / 1000))
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    if (running && remaining <= 0) setRunning(false)
  }, [running, remaining])

  useEffect(() => {
    if (!sessionRunning) return
    const tick = () => setElapsed(Math.floor((Date.now() - sessionStart.current) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [sessionRunning])

  const toggleSession = () => {
    if (sessionRunning) {
      setSessionRunning(false)
    } else {
      // resume from where it stopped rather than restarting at zero
      sessionStart.current = Date.now() - elapsed * 1000
      setSessionRunning(true)
    }
  }

  const startRest = (sec: number) => {
    setTotal(sec)
    endsAt.current = Date.now() + sec * 1000
    setRemaining(sec)
    setRunning(sec > 0)
  }

  const toggleTimer = () => {
    if (running) {
      setRunning(false)
    } else {
      endsAt.current = Date.now() + remaining * 1000
      setRunning(remaining > 0)
    }
  }

  const addTime = (sec: number) => {
    endsAt.current += sec * 1000
    setTotal((t) => t + sec)
    setRemaining((r) => r + sec)
  }

  /* ── actions ── */
  const patchExercise = (patch: Partial<typeof ex>) => {
    if (!ex) return
    setWorkouts((ws) =>
      ws.map((w) =>
        w.id !== workout.id ? w : { ...w, exercises: w.exercises.map((e) => (e.id === ex.id ? { ...e, ...patch } : e)) },
      ),
    )
  }

  const startWorkout = (id: string) => {
    setWorkoutId(id)
    setActive(0)
    setProgress({})
    setArtists({})
    setElapsed(0)
    setRemaining(0)
    setTotal(0)
    sessionStart.current = Date.now()
    setSessionRunning(true)
    setScreen('session')
    setMusicNote('starting music…')
    sp.wakeAndPlay()
      .then((r) => setMusicNote(r === 'playing' ? null : 'could not start music'))
      .catch(() => setMusicNote('could not start music'))
  }

  const go = (dir: 1 | -1) => {
    if (!exercises.length) return
    setActive((a) => (a + dir + exercises.length) % exercises.length)
  }

  /**
   * The primary action. Logs one set, starts the rest countdown, and when the
   * last set of an exercise lands, moves on automatically.
   */
  const completeSet = () => {
    // already at the target: nothing left to log for this exercise
    if (!ex || doneSets >= ex.sets) return

    const next = doneSets + 1
    const nextProgress = { ...progress, [ex.id]: next }
    setProgress(nextProgress)

    // the workout is over only when every exercise has all of its sets in
    const allDone = exercises.every((e) => (nextProgress[e.id] ?? 0) >= e.sets)
    if (allDone) {
      finishWorkout(nextProgress)
      return
    }

    if (next >= ex.sets) {
      // jump to the next exercise that still has sets left
      const at = exercises.findIndex((e) => e.id === ex.id)
      const order = exercises.map((_, i) => (at + 1 + i) % exercises.length)
      const nextIdx = order.find((i) => (nextProgress[exercises[i].id] ?? 0) < exercises[i].sets)
      if (nextIdx !== undefined) setTimeout(() => setActive(nextIdx), 450)
    }

    startRest(ex.restSec)
  }

  /** Builds the summary from whatever has been logged and ends the session. */
  const finishWorkout = (fromProgress: Progress = progress) => {
    let volume = 0
    let sets = 0
    let target = 0
    let exercisesDone = 0
    const muscles = new Set<string>()
    for (const e of exercises) {
      const d = fromProgress[e.id] ?? 0
      volume += d * e.reps * e.kg
      sets += d
      target += e.sets
      if (d > 0) {
        exercisesDone += 1
        e.target.split('·').map((s) => s.trim()).filter(Boolean).forEach((m) => muscles.add(m))
      }
    }
    const top = Object.entries(artists).sort((a, b) => b[1].plays - a[1].plays)[0]

    const data: SummaryData = {
      workoutName: workout?.name ?? 'Workout',
      volumeKg: volume,
      seconds: elapsed,
      sets,
      targetSets: target,
      exercisesDone,
      muscles: [...muscles],
      topArtist: top ? { name: top[0], plays: top[1].plays, art: top[1].art } : undefined,
    }

    setRunning(false)
    setSessionRunning(false)
    setSummary(data)

    // A session with nothing logged is a mis-tap on Finish, not training:
    // recording it would put a 0 kg mark on the calendar and break the streak
    // count's meaning.
    if (sets > 0) {
      appendSession(data)
      refreshHistory()
    }
  }

  /** Clears the session so the next workout starts from zero. */
  const resetSession = () => {
    setScreen('home')
    setProgress({})
    setActive(0)
    setElapsed(0)
    setArtists({})
    setRemaining(0)
    setTotal(0)
  }

  const closeSummary = () => {
    setSummary(null)
    resetSession()
  }

  /** Files a run and drops back to the launcher. */
  const saveRun = (run: { km: number; seconds: number }) => {
    appendRun(run)
    refreshHistory()
    setScreen('home')
  }

  /** Leaves mid-workout with nothing written to the log. */
  const discardWorkout = () => {
    setShowLeave(false)
    setRunning(false)
    setSessionRunning(false)
    resetSession()
  }

  /* ── session stats ── */
  const stats = useMemo(() => {
    let volume = 0
    let sets = 0
    let target = 0
    for (const e of exercises) {
      const d = progress[e.id] ?? 0
      volume += d * e.reps * e.kg
      sets += d
      target += e.sets
    }
    return { volume, sets, target }
  }, [exercises, progress])

  /* ── scale the 1440×900 frame to the window ── */
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    // A viewport that momentarily reports 0 (some embeds do this before first
    // paint) would otherwise pin the whole frame at scale(0) and render nothing.
    const fit = () => {
      const w = window.innerWidth || document.documentElement.clientWidth || 1440
      const h = window.innerHeight || document.documentElement.clientHeight || 900
      setScale(Math.max(0.2, Math.min(w / 1440, h / 900)))
    }
    fit()
    window.addEventListener('resize', fit)
    // catch late layout: an embed can report 0 until after the first frame
    const ro = new ResizeObserver(fit)
    ro.observe(document.documentElement)
    return () => {
      window.removeEventListener('resize', fit)
      ro.disconnect()
    }
  }, [])

  /* ── keyboard shortcuts, handy before hand tracking exists ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault()
          completeSet()
          break
        case 'ArrowRight': go(1); break
        case 'ArrowLeft': go(-1); break
        case 'ArrowUp': e.preventDefault(); if (ex) patchExercise({ kg: ex.kg + 2 }); break
        case 'ArrowDown': e.preventDefault(); if (ex) patchExercise({ kg: Math.max(0, ex.kg - 2) }); break
        case 'r': case 'R': toggleTimer(); break
        case 'w': case 'W': setShowWorkouts((v) => !v); break
        case 'e': case 'E': setShowExercises((v) => !v); break
        case 'Escape': setShowWorkouts(false); setShowExercises(false); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div style={{ width: '100vw', height: '100vh', background: BG, overflow: 'hidden', position: 'relative' }}>
      {/* The tracking engine sits above both screens so switching between them
          never tears down the camera or reloads the model. */}
      <HandControl
        on={handOn}
        onFail={(reason) => {
          setHandOn(false)
          setHandNote(reason)
        }}
      />

      {/* Centred by absolute positioning, not by grid/flex alignment: an item
          larger than its container falls back to start alignment to avoid
          clipping the start edge, which pushed the frame off the bottom. */}
      <div
        style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 1440, height: 900,
          transform: `translate(-50%, -50%) scale(${scale})`,
          background: BG, color: FG,
          // only the live session is split into hero and sidebar; the launcher
          // and the run form own the full frame
          display: screen === 'session' ? 'grid' : 'block',
          gridTemplateColumns: screen === 'session' ? '62fr 38fr' : undefined,
        }}
      >
      {screen === 'home' ? (
        <Home
          workouts={workouts}
          onStart={startWorkout}
          handOn={handOn}
          onToggleHand={toggleHand}
          handNote={handNote}
          musicNote={musicNote}
          onOpenHistory={() => setShowHistory(true)}
          onStartRun={() => setScreen('running')}
          sessionCount={history.length}
          lastSession={history[0] ?? null}
        />
      ) : screen === 'running' ? (
        <Running
          onSave={saveRun}
          onBack={() => setScreen('home')}
          handOn={handOn}
          onToggleHand={toggleHand}
        />
      ) : (
      <>
        {/* ══════════ HERO ══════════ */}
        <section style={{ position: 'relative', borderRight: `1px solid ${LINE}`, padding: '26px 48px 22px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <DwellButton ariaLabel="back to home" onConfirm={() => setShowLeave(true)}>
                <IconChevronL s={13} />
                Back
              </DwellButton>
              <DwellButton ariaLabel="change workout" onConfirm={() => setShowWorkouts(true)}>
                <span style={{ width: 7, height: 7, background: ACCENT, borderRadius: '50%' }} />
                <Label style={{ color: FG, letterSpacing: '0.28em' }}>{workout?.name ?? '—'}</Label>
                <span style={{ color: 'rgba(245,244,239,0.45)', display: 'flex' }}><IconList s={13} /></span>
              </DwellButton>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Label>{exercises.length ? `Exercise ${active + 1} / ${exercises.length}` : 'No exercises'}</Label>
              <HandToggle on={handOn} onToggle={toggleHand} />
              <DwellButton ariaLabel="edit exercises" onConfirm={() => setShowExercises(true)}>
                <IconEdit s={12} /> Edit
              </DwellButton>
            </div>
          </div>

          {!ex ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <Label style={{ display: 'block', marginBottom: 14 }}>This workout has no exercises yet</Label>
                <DwellButton ariaLabel="add exercises" active onConfirm={() => setShowExercises(true)} style={{ padding: '14px 22px' }}>
                  Add exercises
                </DwellButton>
              </div>
            </div>
          ) : (
            <>
              <div style={{ flex: 1, display: 'grid', placeItems: 'center', position: 'relative', marginTop: 6 }}>
                <div style={{ position: 'absolute', left: 0, top: '40%' }}>
                  <GestureTarget size={66} onConfirm={() => go(-1)} ariaLabel="previous exercise"><IconChevronL s={24} /></GestureTarget>
                </div>
                <div style={{ position: 'absolute', right: 0, top: '40%' }}>
                  <GestureTarget size={66} onConfirm={() => go(1)} ariaLabel="next exercise"><IconChevronR s={24} /></GestureTarget>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Cover mediaId={ex.mediaId} gifUrl={ex.gifUrl} frames={ex.frames} name={ex.name} onEdit={() => setShowExercises(true)} />
                  <div className="font-display" style={{ fontWeight: 900, fontSize: 72, lineHeight: 0.88, textTransform: 'uppercase', marginTop: 16, letterSpacing: '-0.01em', textAlign: 'center' }}>
                    {ex.name}
                  </div>
                  {ex.target && <Label style={{ marginTop: 6, letterSpacing: '0.3em' }}>{ex.target}</Label>}

                  {/* set progress dots */}
                  <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
                    {Array.from({ length: ex.sets }).map((_, i) => (
                      <span
                        key={i}
                        style={{
                          width: 26, height: 4,
                          background: i < doneSets ? ACCENT : 'rgba(245,244,239,0.2)',
                          transition: 'background 240ms',
                        }}
                      />
                    ))}
                    <Label style={{ marginLeft: 8 }}>{doneSets} / {ex.sets} sets</Label>
                  </div>
                </div>
              </div>

              {/* stats + DONE */}
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                <StatBlock label="Sets" value={ex.sets} onInc={() => patchExercise({ sets: ex.sets + 1 })} onDec={() => patchExercise({ sets: Math.max(1, ex.sets - 1) })} />
                <StatBlock label="Reps" value={ex.reps} onInc={() => patchExercise({ reps: ex.reps + 1 })} onDec={() => patchExercise({ reps: Math.max(0, ex.reps - 1) })} />
                <StatBlock label="Load" value={ex.kg} unit="kg" onInc={() => patchExercise({ kg: ex.kg + 2 })} onDec={() => patchExercise({ kg: Math.max(0, ex.kg - 2) })} />

                <div style={{ width: 190, border: `1px solid ${ACCENT}`, background: 'rgba(214,48,34,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <GestureTarget
                    size={72}
                    tone="accent"
                    onConfirm={completeSet}
                    ariaLabel="complete set"
                    disabled={doneSets >= ex.sets}
                  >
                    <IconCheck s={30} c={ACCENT} />
                  </GestureTarget>
                  <Label style={{ color: FG, letterSpacing: '0.26em' }}>
                    {doneSets >= ex.sets ? 'Complete' : 'Done set'}
                  </Label>
                  <Label style={{ fontSize: 9, color: 'rgba(245,244,239,0.45)' }}>
                    {doneSets >= ex.sets ? 'all sets logged' : `starts ${ex.restSec}s rest`}
                  </Label>
                </div>
              </div>

              {/* filmstrip */}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Label>Up Next · Queue</Label>
                  <Label style={{ color: 'rgba(245,244,239,0.35)' }}>Space done · ←→ move · ↑↓ kg · R rest · W E edit</Label>
                </div>
                <div style={{ display: 'flex', gap: 10, overflow: 'hidden' }}>
                  {exercises.map((q, i) => (
                    <QueueItem key={q.id} ex={q} activeItem={i === active} done={(progress[q.id] ?? 0) >= q.sets} onPick={() => setActive(i)} />
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        {/* ══════════ SIDEBAR ══════════ */}
        {/* Spotify is the tallest band by a wide margin: the album is the thing
            you look at between sets, the timer only needs to read at a glance. */}
        <aside style={{ display: 'grid', gridTemplateRows: '1.85fr 0.95fr 0.6fr', minHeight: 0 }}>
          <SpotifyPanel
            onTrackChange={(artist, art) =>
              setArtists((a) => ({ ...a, [artist]: { plays: (a[artist]?.plays ?? 0) + 1, art: a[artist]?.art ?? art } }))
            }
          />
          <RestTimer remaining={Math.ceil(remaining)} total={total} running={running} onToggle={toggleTimer} onAdd={addTime} />

          <div style={{ padding: '16px 30px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Label>Session</Label>
              <Label style={{ color: 'rgba(245,244,239,0.35)' }}>{workout?.name}</Label>
            </div>
            <div style={{ flex: 1, border: `1px solid ${LINE}`, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {[
                { k: 'Volume', v: stats.volume.toLocaleString(), u: 'kg' },
                { k: 'Elapsed', v: mmss(elapsed), u: 'min', control: true },
                { k: 'Sets Done', v: String(stats.sets), u: `/ ${stats.target}` },
                { k: 'Exercises', v: String(exercises.length), u: 'total' },
              ].map((s, i) => (
                <div
                  key={s.k}
                  style={{
                    padding: '12px 16px',
                    borderRight: i % 2 === 0 ? `1px solid ${LINE}` : 'none',
                    borderTop: i > 1 ? `1px solid ${LINE}` : 'none',
                    display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center',
                  }}
                >
                  <Label style={{ fontSize: 9, color: s.control && sessionRunning ? ACCENT : undefined }}>{s.k}</Label>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span className="font-display" style={{ fontWeight: 800, fontSize: 30, lineHeight: 0.85 }}>{s.v}</span>
                    <Label style={{ fontSize: 9 }}>{s.u}</Label>
                    {s.control && (
                      <span style={{ marginLeft: 'auto', alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <GestureTarget size={46} onConfirm={toggleSession} ariaLabel="start pause workout">
                          {sessionRunning ? <IconPause s={18} c={ACCENT} /> : <IconPlay s={18} />}
                        </GestureTarget>
                        <DwellButton
                          ariaLabel="finish workout now"
                          onConfirm={() => finishWorkout()}
                          style={{ padding: '9px 11px', borderColor: ACCENT }}
                        >
                          Finish
                        </DwellButton>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

      </>
      )}

        {summary && <Summary data={summary} onClose={closeSummary} />}

        {showHistory && (
          <History
            records={history}
            onClose={() => setShowHistory(false)}
            handOn={handOn}
            onToggleHand={toggleHand}
          />
        )}

        {showLeave && (
          <LeaveWorkout
            workoutName={workout?.name ?? 'Workout'}
            sets={stats.sets}
            targetSets={stats.target}
            volumeKg={stats.volume}
            onSave={() => { setShowLeave(false); finishWorkout() }}
            onDiscard={discardWorkout}
            onCancel={() => setShowLeave(false)}
          />
        )}

        {showWorkouts && (
          <WorkoutPicker
            workouts={workouts}
            activeId={workout.id}
            onPick={(id) => { setWorkoutId(id); setActive(0); setProgress({}) }}
            onChange={setWorkouts}
            onClose={() => setShowWorkouts(false)}
          />
        )}
        {showExercises && workout && (
          <ExerciseEditor
            workout={workout}
            onChange={(w) => setWorkouts((ws) => ws.map((x) => (x.id === w.id ? w : x)))}
            onClose={() => setShowExercises(false)}
          />
        )}
      </div>
    </div>
  )
}

function QueueItem({ ex, activeItem, done, onPick }: { ex: { id: string; name: string; mediaId?: string; gifUrl?: string; frames?: string[] }; activeItem: boolean; done: boolean; onPick: () => void }) {
  // thumbnails hold the first frame: eight of these cycling at once would pull
  // the eye away from the exercise you are actually on
  const url = useMediaUrl(ex.mediaId, ex.gifUrl) ?? ex.frames?.[0]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: 88, flexShrink: 0 }}>
      <DwellArea
        ariaLabel={`go to ${ex.name}`}
        onConfirm={onPick}
        style={{
          position: 'relative', width: 88, height: 88, background: '#161310',
          border: activeItem ? `1px solid ${ACCENT}` : `1px solid ${LINE}`,
          boxShadow: activeItem ? '0 0 16px rgba(214,48,34,0.25)' : 'none',
        }}
      >
        {url && <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: activeItem ? 'none' : 'grayscale(1) brightness(0.7)' }} />}
        {done && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(12,11,9,0.6)', display: 'grid', placeItems: 'center' }}>
            <IconCheck s={22} c={ACCENT} />
          </div>
        )}
        {activeItem && <div style={{ position: 'absolute', bottom: 5, left: 5, width: 8, height: 8, background: ACCENT }} />}
      </DwellArea>
      <Label style={{ fontSize: 9, color: activeItem ? FG : 'rgba(245,244,239,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</Label>
    </div>
  )
}
