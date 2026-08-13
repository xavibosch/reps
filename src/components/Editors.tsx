import { useRef, useState } from 'react'
import type { Exercise, Workout } from '../types'
import { delMedia, putMedia } from '../lib/db'
import { uid, useMediaUrl } from '../lib/store'
import {
  ACCENT, FG, LINE, LINE_STRONG, Field, GestureTarget, DwellArea, DwellButton, Label, Overlay,
  IconCheck, IconEdit, IconPlus, IconTrash, IconUpload,
} from './ui'

const rowBtn = {
  border: `1px solid ${LINE_STRONG}`,
  padding: '8px 12px',
  justifyContent: 'center',
}

/* ══════════════════ workout picker ══════════════════ */
export function WorkoutPicker({
  workouts,
  activeId,
  onPick,
  onChange,
  onClose,
}: {
  workouts: Workout[]
  activeId: string
  onPick: (id: string) => void
  onChange: (next: Workout[]) => void
  onClose: () => void
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const addWorkout = () => {
    const w: Workout = { id: uid(), name: 'New Workout', exercises: [] }
    onChange([...workouts, w])
    setRenaming(w.id)
    setDraft(w.name)
  }

  const remove = (id: string) => {
    if (workouts.length <= 1) return
    const next = workouts.filter((w) => w.id !== id)
    onChange(next)
    if (id === activeId) onPick(next[0].id)
  }

  const commitRename = (id: string) => {
    onChange(workouts.map((w) => (w.id === id ? { ...w, name: draft.trim() || w.name } : w)))
    setRenaming(null)
  }

  return (
    <Overlay title="Workouts" onClose={onClose} width={720}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {workouts.map((w) => {
          const active = w.id === activeId
          return (
            <div
              key={w.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                border: `1px solid ${active ? ACCENT : LINE}`,
                background: active ? 'rgba(214,48,34,0.07)' : 'transparent',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                {renaming === w.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitRename(w.id)}
                    onKeyDown={(e) => e.key === 'Enter' && commitRename(w.id)}
                    style={{ background: 'transparent', border: `1px solid ${LINE_STRONG}`, color: FG, font: "16px 'Big Shoulders Display', sans-serif", padding: '6px 10px', width: '100%', outline: 'none' }}
                  />
                ) : (
                  <>
                    <div className="font-display" style={{ fontWeight: 800, fontSize: 26, lineHeight: 1, textTransform: 'uppercase' }}>
                      {w.name}
                    </div>
                    <Label style={{ marginTop: 5, display: 'block' }}>
                      {w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'}
                    </Label>
                  </>
                )}
              </div>
              <DwellButton ariaLabel={`rename ${w.name}`} onConfirm={() => { setRenaming(w.id); setDraft(w.name) }} style={rowBtn}>
                <IconEdit s={13} />
              </DwellButton>
              <DwellButton ariaLabel="action" onConfirm={() => remove(w.id)} style={{ ...rowBtn, opacity: workouts.length <= 1 ? 0.3 : 1  }}>
                <IconTrash s={13} />
              </DwellButton>
              {!active && (
                <DwellButton ariaLabel="start" onConfirm={() => { onPick(w.id); onClose() }} style={{ ...rowBtn, borderColor: ACCENT  }}>
                  Start
                </DwellButton>
              )}
              {active && <Label style={{ color: ACCENT }}>Active</Label>}
            </div>
          )
        })}

        <DwellButton ariaLabel="new workout" onConfirm={addWorkout} style={{ ...rowBtn, padding: '16px', borderStyle: 'dashed' }}>
          <IconPlus s={14} /> New workout
        </DwellButton>
      </div>
    </Overlay>
  )
}

/* ══════════════════ exercise list editor ══════════════════ */
export function ExerciseEditor({
  workout,
  onChange,
  onClose,
}: {
  workout: Workout
  onChange: (w: Workout) => void
  onClose: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)

  const update = (id: string, patch: Partial<Exercise>) =>
    onChange({ ...workout, exercises: workout.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) })

  const add = () => {
    const e: Exercise = { id: uid(), name: 'New Exercise', target: '', sets: 3, reps: 10, kg: 20, restSec: 90 }
    onChange({ ...workout, exercises: [...workout.exercises, e] })
    setEditing(e.id)
  }

  const remove = (id: string) => {
    const ex = workout.exercises.find((e) => e.id === id)
    if (ex?.mediaId) delMedia(ex.mediaId).catch(() => {})
    onChange({ ...workout, exercises: workout.exercises.filter((e) => e.id !== id) })
  }

  const move = (id: string, dir: -1 | 1) => {
    const list = [...workout.exercises]
    const i = list.findIndex((e) => e.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    onChange({ ...workout, exercises: list })
  }

  return (
    <Overlay title={`${workout.name} · Exercises`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {workout.exercises.map((ex, i) => (
          <ExerciseRow
            key={ex.id}
            ex={ex}
            index={i}
            expanded={editing === ex.id}
            onToggle={() => setEditing(editing === ex.id ? null : ex.id)}
            onUpdate={(patch) => update(ex.id, patch)}
            onRemove={() => remove(ex.id)}
            onMove={(d) => move(ex.id, d)}
          />
        ))}
        <DwellButton ariaLabel="add exercise" onConfirm={add} style={{ ...rowBtn, padding: '16px', borderStyle: 'dashed' }}>
          <IconPlus s={14} /> Add exercise
        </DwellButton>
      </div>
    </Overlay>
  )
}

function ExerciseRow({
  ex, index, expanded, onToggle, onUpdate, onRemove, onMove,
}: {
  ex: Exercise
  index: number
  expanded: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<Exercise>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const art = useMediaUrl(ex.mediaId, ex.gifUrl)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const upload = async (file?: File | null) => {
    if (!file) return
    setBusy(true)
    try {
      const id = ex.mediaId || uid()
      await putMedia(id, file)
      // bump a nonce so the media hook refetches even when the id is unchanged
      onUpdate({ mediaId: id, gifUrl: undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ border: `1px solid ${expanded ? ACCENT : LINE}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12 }}>
        <Label style={{ width: 22 }}>{String(index + 1).padStart(2, '0')}</Label>
        <div style={{ width: 56, height: 56, border: `1px solid ${LINE_STRONG}`, background: '#161310', flexShrink: 0 }}>
          {art && <img src={art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-display" style={{ fontWeight: 700, fontSize: 20, lineHeight: 1, textTransform: 'uppercase' }}>{ex.name}</div>
          <Label style={{ marginTop: 4, display: 'block' }}>{ex.sets} × {ex.reps} · {ex.kg}kg · {ex.restSec}s rest</Label>
        </div>
        <DwellButton ariaLabel={`move ${ex.name} up`} onConfirm={() => onMove(-1)} style={rowBtn}>↑</DwellButton>
        <DwellButton ariaLabel={`move ${ex.name} down`} onConfirm={() => onMove(1)} style={rowBtn}>↓</DwellButton>
        <DwellButton ariaLabel={`edit ${ex.name}`} onConfirm={onToggle} style={rowBtn}><IconEdit s={13} /></DwellButton>
        <DwellButton ariaLabel={`delete ${ex.name}`} onConfirm={onRemove} style={rowBtn}><IconTrash s={13} /></DwellButton>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${LINE}`, padding: 16, display: 'flex', gap: 20 }}>
          {/* GIF upload */}
          <div style={{ width: 180, flexShrink: 0 }}>
            <Label style={{ display: 'block', marginBottom: 8 }}>Demo GIF</Label>
            <DwellArea
              ariaLabel="upload demo gif"
              onConfirm={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files?.[0]) }}
              style={{
                width: 180, height: 180, border: `1px dashed ${LINE_STRONG}`, background: '#161310',
                display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden',
              }}
            >
              {art ? (
                <img src={art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ textAlign: 'center', color: 'rgba(245,244,239,0.5)' }}>
                  <IconUpload />
                  <Label style={{ display: 'block', marginTop: 8, fontSize: 9 }}>Drop or click</Label>
                </div>
              )}
              {busy && (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(12,11,9,0.7)' }}>
                  <Label>Saving…</Label>
                </div>
              )}
            </DwellArea>
            <input
              ref={fileRef}
              type="file"
              accept="image/gif,image/*,video/mp4,video/webm"
              hidden
              onChange={(e) => upload(e.target.files?.[0])}
            />
            {ex.mediaId && (
              <button
                style={{ ...rowBtn, width: '100%', marginTop: 8 }}
                onPointerDown={() => { delMedia(ex.mediaId!).catch(() => {}); onUpdate({ mediaId: undefined }) }}
              >
                Remove GIF
              </button>
            )}
          </div>

          {/* fields */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Field label="Name" value={ex.name} onChange={(v) => onUpdate({ name: v })} />
              <Field label="Target" value={ex.target} onChange={(v) => onUpdate({ target: v })} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Field label="Sets" type="number" value={ex.sets} onChange={(v) => onUpdate({ sets: Math.max(1, +v || 0) })} />
              <Field label="Reps" type="number" value={ex.reps} onChange={(v) => onUpdate({ reps: Math.max(0, +v || 0) })} />
              <Field label="Kg" type="number" value={ex.kg} onChange={(v) => onUpdate({ kg: Math.max(0, +v || 0) })} />
              <Field label="Rest (s)" type="number" value={ex.restSec} onChange={(v) => onUpdate({ restSec: Math.max(0, +v || 0) })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <GestureTarget size={44} tone="accent" onConfirm={onToggle} ariaLabel="done editing">
                <IconCheck s={20} c={ACCENT} />
              </GestureTarget>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
