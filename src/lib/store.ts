import { useCallback, useEffect, useState } from 'react'
import type { Workout } from '../types'
import { getMedia } from './db'

// Bumped when the shipped routines change: existing saved data would otherwise
// hide the new ones, since the seed is only used when storage is empty.
const KEY = 'home-gym.workouts.v2'

export const uid = () => Math.random().toString(36).slice(2, 10)

/**
 * Exercises shipping with demo stills in `public/exercises`, two frames each
 * (start and end of the rep) so the app is useful before anything is uploaded.
 *
 * The photos come from free-exercise-db, which is released under the Unlicense
 * into the public domain. That matters: the exercise GIFs everyone recognises
 * (MuscleWiki and friends) are copyrighted and cannot be bundled.
 *
 * Names are the key, so the same movement in two routines shares one download.
 */
const DEMOS = new Set([
  'Barbell Row', 'Romanian Deadlift', 'One Arm Dumbbell Row', 'Dumbbell Pullover',
  'Barbell Curl', 'Hammer Curl', 'Concentration Curl',
  'Barbell Bench Press', 'Incline Dumbbell Press', 'Dumbbell Fly', 'Overhead Press',
  'Lateral Raise', 'Skull Crusher', 'Overhead Triceps Extension',
  'Barbell Back Squat', 'Bulgarian Split Squat', 'Dumbbell Step Up',
  'Barbell Hip Thrust', 'Standing Calf Raise', 'Curl into Skull Crusher',
])

/** Must stay in step with the slug the download script wrote to disk. */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const demoFrames = (name: string) =>
  DEMOS.has(name) ? [`/exercises/${slug(name)}-0.jpg`, `/exercises/${slug(name)}-1.jpg`] : undefined

/** Seed content, replaced the moment the user edits anything. */
/**
 * Built around one bench, one barbell, two dumbbells and 30kg of plates
 * (4x5kg + 5x2kg). Loads assume a ~10kg bar and ~2kg dumbbell handles, so
 * check yours and adjust with the +/- controls.
 *
 * Exercise names are in English because that is what returns usable demo GIFs.
 */
const SEED: Workout[] = [
  {
    id: uid(),
    name: 'Back & Biceps',
    exercises: [
      { id: uid(), name: 'Barbell Row', target: 'Back · Lats', sets: 4, reps: 8, kg: 30, restSec: 150 },
      { id: uid(), name: 'Romanian Deadlift', target: 'Lower Back · Hamstrings', sets: 3, reps: 10, kg: 30, restSec: 150 },
      { id: uid(), name: 'One Arm Dumbbell Row', target: 'Lats · Bench supported', sets: 3, reps: 10, kg: 12, restSec: 120 },
      { id: uid(), name: 'Dumbbell Pullover', target: 'Lats · Chest', sets: 3, reps: 12, kg: 6, restSec: 90 },
      { id: uid(), name: 'Barbell Curl', target: 'Biceps', sets: 4, reps: 10, kg: 14, restSec: 90 },
      { id: uid(), name: 'Hammer Curl', target: 'Biceps · Forearm', sets: 3, reps: 12, kg: 6, restSec: 90 },
      { id: uid(), name: 'Concentration Curl', target: 'Biceps · Seated', sets: 3, reps: 12, kg: 6, restSec: 90 },
    ],
  },
  {
    id: uid(),
    name: 'Chest, Triceps & Shoulders',
    exercises: [
      { id: uid(), name: 'Barbell Bench Press', target: 'Chest', sets: 4, reps: 8, kg: 30, restSec: 150 },
      { id: uid(), name: 'Incline Dumbbell Press', target: 'Upper Chest', sets: 3, reps: 10, kg: 12, restSec: 120 },
      { id: uid(), name: 'Dumbbell Fly', target: 'Chest · Bench', sets: 3, reps: 12, kg: 6, restSec: 90 },
      { id: uid(), name: 'Overhead Press', target: 'Shoulders · Standing', sets: 4, reps: 8, kg: 20, restSec: 150 },
      { id: uid(), name: 'Lateral Raise', target: 'Side Delts', sets: 4, reps: 15, kg: 4, restSec: 60 },
      { id: uid(), name: 'Skull Crusher', target: 'Triceps · Bench', sets: 3, reps: 10, kg: 14, restSec: 90 },
      { id: uid(), name: 'Overhead Triceps Extension', target: 'Triceps', sets: 3, reps: 12, kg: 6, restSec: 90 },
    ],
  },
  {
    id: uid(),
    name: 'Legs',
    exercises: [
      { id: uid(), name: 'Barbell Back Squat', target: 'Quads · Glutes', sets: 4, reps: 12, kg: 30, restSec: 180 },
      { id: uid(), name: 'Bulgarian Split Squat', target: 'Quads · Glutes · Bench', sets: 3, reps: 12, kg: 12, restSec: 120 },
      { id: uid(), name: 'Romanian Deadlift', target: 'Hamstrings · Glutes', sets: 4, reps: 12, kg: 30, restSec: 150 },
      { id: uid(), name: 'Dumbbell Step Up', target: 'Quads · Glutes · Bench', sets: 3, reps: 12, kg: 12, restSec: 90 },
      { id: uid(), name: 'Barbell Hip Thrust', target: 'Glutes · Bench', sets: 4, reps: 15, kg: 30, restSec: 120 },
      { id: uid(), name: 'Standing Calf Raise', target: 'Calves', sets: 4, reps: 20, kg: 12, restSec: 60 },
    ],
  },
  {
    id: uid(),
    name: 'Full Body',
    exercises: [
      { id: uid(), name: 'Barbell Back Squat', target: 'Quads · Glutes', sets: 3, reps: 10, kg: 30, restSec: 150 },
      { id: uid(), name: 'Barbell Bench Press', target: 'Chest', sets: 3, reps: 10, kg: 30, restSec: 150 },
      { id: uid(), name: 'Barbell Row', target: 'Back · Lats', sets: 3, reps: 10, kg: 30, restSec: 150 },
      { id: uid(), name: 'Overhead Press', target: 'Shoulders', sets: 3, reps: 10, kg: 20, restSec: 150 },
      { id: uid(), name: 'Romanian Deadlift', target: 'Hamstrings', sets: 3, reps: 12, kg: 30, restSec: 150 },
      { id: uid(), name: 'Curl into Skull Crusher', target: 'Biceps · Triceps superset', sets: 2, reps: 12, kg: 14, restSec: 90 },
    ],
  },
]

/**
 * Attaches the bundled demos to any exercise that does not already carry them.
 *
 * Applied on read rather than by bumping the storage key: saved data predates
 * the demos, and re-seeding would throw away the loads and rep counts the user
 * has dialled in. Anything they uploaded wins anyway, since mediaId is checked
 * first when the artwork is resolved.
 */
const withDemos = (ws: Workout[]): Workout[] =>
  ws.map((w) => ({
    ...w,
    exercises: w.exercises.map((e) => (e.frames?.length ? e : { ...e, frames: demoFrames(e.name) })),
  }))

function load(): Workout[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return withDemos(SEED)
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length) return withDemos(parsed)
  } catch {
    /* corrupted or unavailable storage falls back to the seed */
  }
  return withDemos(SEED)
}

export function useWorkouts() {
  const [workouts, setWorkouts] = useState<Workout[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(workouts))
    } catch {
      /* quota or private mode: keep running from memory */
    }
  }, [workouts])

  return [workouts, setWorkouts] as const
}

/**
 * Cycles the bundled stills so a two-frame demo reads as a movement.
 *
 * The effect keys off the joined paths rather than the array itself: the
 * workout objects are rebuilt on every edit, so a new array identity would
 * restart the interval and stall the animation on the first frame.
 */
export function useFrameCycle(frames?: string[], ms = 900) {
  const [i, setI] = useState(0)
  const key = frames?.join('|') ?? ''

  useEffect(() => {
    setI(0)
    if (!frames || frames.length < 2) return
    const id = setInterval(() => setI((n) => (n + 1) % frames.length), ms)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ms])

  if (!frames || !frames.length) return undefined
  return frames[i % frames.length]
}

/**
 * Resolves an exercise's artwork to a displayable URL.
 *
 * An uploaded Blob needs an object URL, which must be revoked when it changes
 * or the component unmounts, otherwise every workout switch leaks a blob.
 */
export function useMediaUrl(mediaId?: string, fallback?: string) {
  const [url, setUrl] = useState<string | undefined>(fallback)

  useEffect(() => {
    let revoked = false
    let objectUrl: string | undefined

    if (!mediaId) {
      setUrl(fallback)
      return
    }

    getMedia(mediaId)
      .then((blob) => {
        if (revoked) return
        if (!blob) {
          setUrl(fallback)
          return
        }
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => setUrl(fallback))

    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [mediaId, fallback])

  return url
}

/** Stable callback that always sees the latest value without re-subscribing. */
export function useEvent<T extends (...args: never[]) => unknown>(fn: T) {
  const [ref] = useState({ current: fn })
  ref.current = fn
  return useCallback((...args: Parameters<T>) => ref.current(...args), [ref]) as T
}
