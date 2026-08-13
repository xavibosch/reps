export type Exercise = {
  id: string
  name: string
  target: string
  /** IndexedDB key for an uploaded GIF/video. Takes priority over everything. */
  mediaId?: string
  /** Fallback remote image, used until a GIF is uploaded. */
  gifUrl?: string
  /**
   * Bundled demo stills, cycled to fake the loop a GIF would give.
   * The shipped set has two: the start and the end of the rep.
   */
  frames?: string[]
  sets: number
  reps: number
  kg: number
  /** Rest between sets, in seconds. Per exercise: legs need longer than curls. */
  restSec: number
}

export type Workout = {
  id: string
  name: string
  exercises: Exercise[]
}

/** Completed sets in the current session, keyed by exercise id. */
export type Progress = Record<string, number>
