import { useCallback, useEffect, useState } from 'react'
import type { SummaryData } from '../components/Summary'

/**
 * Finished sessions, kept in localStorage.
 *
 * Same store as the workouts, deliberately: this app has no backend and no
 * account, so anything that needs a server would need a login, and the whole
 * point is that it opens and works.
 */
const KEY = 'home-gym.history.v1'

export type SessionRecord = SummaryData & {
  id: string
  /** Local YYYY-MM-DD, so the calendar can key off it with no conversion. */
  day: string
  finishedAt: number
  /**
   * Present only on runs. A run has no volume and no sets, so the lifting
   * fields sit at zero and the numbers worth reading live here instead.
   */
  run?: { km: number; paceSec: number }
}

/**
 * Local calendar day, not `toISOString()`.
 *
 * ISO strings are UTC, which would file a 23:30 session under tomorrow for
 * anyone east of Greenwich and under today for anyone west. The calendar has
 * to agree with the day the user thinks they trained.
 */
export const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * A session that happened before the log existed.
 *
 * Xavi finished this one on 2026-08-13, the same day the log shipped, so it
 * would otherwise be the single workout missing from the calendar. Its own
 * marker key guards it: without that, every reload would add it again, and
 * clearing it from the log would only bring it back.
 */
const BACKFILL_MARK = 'home-gym.history.backfill.2026-08-13'
const BACKFILL: SessionRecord = {
  id: 'logged-before-the-log-existed',
  day: '2026-08-13',
  finishedAt: new Date(2026, 7, 13, 19, 0, 0).getTime(),
  workoutName: 'Chest, Triceps & Shoulders',
  volumeKg: 5956,
  seconds: 73 * 60,
  sets: 22,
  targetSets: 24,
  exercisesDone: 7,
  muscles: ['Chest', 'Upper Chest', 'Bench', 'Shoulders', 'Standing', 'Side Delts', 'Triceps'],
  topArtist: { name: 'Drake', plays: 4 },
}

function runBackfill(records: SessionRecord[]): SessionRecord[] {
  try {
    if (localStorage.getItem(BACKFILL_MARK)) return records
    // mark first: a failure past this point should not retry forever
    localStorage.setItem(BACKFILL_MARK, new Date().toISOString())
    if (records.some((r) => r.id === BACKFILL.id)) return records
    const merged = [BACKFILL, ...records]
    save(merged)
    return merged
  } catch {
    return records
  }
}

export function loadHistory(): SessionRecord[] {
  let records: SessionRecord[] = []
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) records = parsed
  } catch {
    /* corrupted or unavailable storage starts empty rather than throwing */
  }
  // newest first, so "last workout" is just [0]
  return runBackfill(records).sort((a, b) => b.finishedAt - a.finishedAt)
}

function save(records: SessionRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(records))
  } catch {
    /* quota or private mode: the session still finished, it just is not kept */
  }
}

export function appendSession(data: SummaryData, run?: { km: number; paceSec: number }): SessionRecord {
  const now = new Date()
  const record: SessionRecord = {
    ...data,
    id: `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    day: localDay(now),
    finishedAt: now.getTime(),
    ...(run ? { run } : {}),
  }
  save([record, ...loadHistory()])
  return record
}

/** Files a run under today, alongside the lifting sessions. */
export function appendRun({ km, seconds }: { km: number; seconds: number }): SessionRecord {
  return appendSession({
    workoutName: 'Running',
    volumeKg: 0,
    seconds,
    sets: 0,
    targetSets: 0,
    exercisesDone: 0,
    muscles: ['Cardio', 'Legs'],
  }, { km, paceSec: km > 0 ? seconds / km : 0 })
}

export function deleteSession(id: string) {
  save(loadHistory().filter((r) => r.id !== id))
}

export type Totals = {
  sessions: number
  volumeKg: number
  seconds: number
  sets: number
  /** Consecutive days ending today or yesterday. Yesterday still counts, so a
   *  streak is not lost simply because today's session has not happened yet. */
  streak: number
  topArtist?: { name: string; plays: number }
  daysTrained: number
  /** Summed across runs only; zero when nothing has been run. */
  distanceKm: number
}

export function totalsOf(records: SessionRecord[]): Totals {
  const artists = new Map<string, number>()
  let volumeKg = 0
  let seconds = 0
  let sets = 0
  let distanceKm = 0

  for (const r of records) {
    volumeKg += r.volumeKg
    seconds += r.seconds
    sets += r.sets
    distanceKm += r.run?.km ?? 0
    if (r.topArtist) artists.set(r.topArtist.name, (artists.get(r.topArtist.name) ?? 0) + r.topArtist.plays)
  }

  const days = new Set(records.map((r) => r.day))

  // walk back from today; allow the streak to start at yesterday
  let streak = 0
  const cursor = new Date()
  if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1)
  while (days.has(localDay(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  const top = [...artists.entries()].sort((a, b) => b[1] - a[1])[0]

  return {
    sessions: records.length,
    volumeKg,
    seconds,
    sets,
    streak,
    daysTrained: days.size,
    distanceKm: Math.round(distanceKm * 10) / 10,
    topArtist: top ? { name: top[0], plays: top[1] } : undefined,
  }
}

/** Records plus a refresh, so the calendar updates the moment one is added. */
export function useHistory() {
  const [records, setRecords] = useState<SessionRecord[]>([])
  const refresh = useCallback(() => setRecords(loadHistory()), [])
  useEffect(refresh, [refresh])
  return [records, refresh] as const
}
