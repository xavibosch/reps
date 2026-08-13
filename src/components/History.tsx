import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { localDay, totalsOf, type SessionRecord } from '../lib/history'
import { HandToggle } from './HandControl'
import { ACCENT, BG, FG, LINE, LINE_STRONG, DwellArea, DwellButton, GestureTarget, IconChevronL, IconChevronR, Label } from './ui'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** Monday first: a training week is not read starting on Sunday. */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

const fmtPace = (secPerKm: number) =>
  Number.isFinite(secPerKm) && secPerKm > 0
    ? `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')}`
    : '—'

const hoursMins = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m`
}

/**
 * Builds the cells for one month, padded so the 1st lands under its weekday.
 * `getDay()` is Sunday-based, so Monday-first needs the shift.
 */
function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= days; d++) cells.push(localDay(new Date(year, month, d)))
  return cells
}

export function History({
  records,
  onClose,
  handOn,
  onToggleHand,
}: {
  records: SessionRecord[]
  onClose: () => void
  handOn: boolean
  onToggleHand: () => void
}) {
  const today = new Date()
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })
  // opens on the most recent session, which is what you want to see first
  const [selectedId, setSelectedId] = useState<string | null>(records[0]?.id ?? null)

  const byDay = useMemo(() => {
    const map = new Map<string, SessionRecord[]>()
    for (const r of records) map.set(r.day, [...(map.get(r.day) ?? []), r])
    // records arrive newest first, but a single day reads better in the order
    // it actually happened: the run, then the lifting session
    for (const list of map.values()) list.sort((a, b) => a.finishedAt - b.finishedAt)
    return map
  }, [records])

  const totals = useMemo(() => totalsOf(records), [records])
  const cells = useMemo(() => monthCells(cursor.y, cursor.m), [cursor])
  const selected = records.find((r) => r.id === selectedId) ?? records[0]

  /**
   * A day can hold more than one session: a run in the morning and a lifting
   * session later is a normal day, not an edge case. The panel pages through
   * whatever that day holds rather than silently showing only the first.
   */
  const daySessions = selected ? byDay.get(selected.day) ?? [selected] : []
  const position = daySessions.findIndex((r) => r.id === selected?.id)

  const cycle = (dir: 1 | -1) => {
    if (daySessions.length < 2) return
    setSelectedId(daySessions[(position + dir + daySessions.length) % daySessions.length].id)
  }

  const shiftMonth = (by: number) => {
    const d = new Date(cursor.y, cursor.m + by, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }

  const stat = (label: string, value: string, unit?: string) => (
    <div style={{ flex: 1, padding: '14px 18px', borderRight: `1px solid ${LINE}` }}>
      <Label style={{ fontSize: 9 }}>{label}</Label>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 6 }}>
        <span className="font-display" style={{ fontWeight: 800, fontSize: 38, lineHeight: 0.84 }}>{value}</span>
        {unit && <Label style={{ fontSize: 9 }}>{unit}</Label>}
      </div>
    </div>
  )

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: BG, zIndex: 190, display: 'grid', placeItems: 'center', animation: 'titleIn 320ms ease-out both' }}>
      <div style={{ width: 'min(1180px, 94vw)', maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: `1px solid ${LINE_STRONG}`, paddingBottom: 14 }}>
          <div>
            <Label style={{ color: ACCENT, letterSpacing: '0.3em' }}>Training log</Label>
            <div className="font-display" style={{ fontWeight: 900, fontSize: 62, lineHeight: 0.88, textTransform: 'uppercase', marginTop: 8 }}>
              {totals.sessions} session{totals.sessions === 1 ? '' : 's'}
            </div>
          </div>
          {/* The log is dwell-driven like everything else, so the hand toggle
              has to be reachable from here too, not only from the home screen. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <HandToggle on={handOn} onToggle={onToggleHand} />
            <DwellButton ariaLabel="close training log" active onConfirm={onClose} style={{ padding: '13px 24px' }}>
              Done
            </DwellButton>
          </div>
        </div>

        {/* ── all time ── */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${LINE}` }}>
          {stat('Total volume', totals.volumeKg.toLocaleString(), 'kg')}
          {/* only worth a column once something has actually been run */}
          {totals.distanceKm > 0 && stat('Distance', totals.distanceKm.toFixed(1), 'km')}
          {stat('Total time', hoursMins(totals.seconds))}
          {stat('Total sets', String(totals.sets))}
          {stat('Days trained', String(totals.daysTrained))}
          {stat('Streak', String(totals.streak), 'days')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 34, paddingTop: 24 }}>
          {/* ── calendar ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Label style={{ letterSpacing: '0.26em', color: FG }}>
                {MONTHS[cursor.m]} {cursor.y}
              </Label>
              <div style={{ display: 'flex', gap: 8 }}>
                <GestureTarget size={40} ariaLabel="previous month" onConfirm={() => shiftMonth(-1)}><IconChevronL s={16} /></GestureTarget>
                <GestureTarget size={40} ariaLabel="next month" onConfirm={() => shiftMonth(1)}><IconChevronR s={16} /></GestureTarget>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
              {WEEKDAYS.map((w, i) => (
                <Label key={i} style={{ fontSize: 9, textAlign: 'center', color: 'rgba(245,244,239,0.35)' }}>{w}</Label>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {cells.map((day, i) => {
                if (!day) return <div key={`pad${i}`} />
                const sessions = byDay.get(day)
                const isToday = day === localDay(today)
                const isSelected = !!sessions?.some((s) => s.id === selected?.id)
                const n = Number(day.slice(-2))

                // days with nothing on them are not dwell targets: the hand
                // cursor should not have to thread between dead controls
                if (!sessions) {
                  return (
                    <div
                      key={day}
                      style={{
                        aspectRatio: '1', display: 'grid', placeItems: 'center',
                        border: `1px solid ${isToday ? LINE_STRONG : 'transparent'}`,
                        color: 'rgba(245,244,239,0.25)', font: "11px 'DM Mono', monospace",
                      }}
                    >
                      {n}
                    </div>
                  )
                }

                return (
                  <DwellArea
                    key={day}
                    ariaLabel={`show ${day}`}
                    onConfirm={() => setSelectedId(sessions[0].id)}
                    style={{
                      aspectRatio: '1', display: 'grid', placeItems: 'center',
                      background: isSelected ? ACCENT : 'rgba(214,48,34,0.16)',
                      border: `1px solid ${isSelected ? ACCENT : 'rgba(214,48,34,0.5)'}`,
                    }}
                  >
                    <span style={{ font: "12px 'DM Mono', monospace", color: isSelected ? BG : FG, fontWeight: isSelected ? 700 : 400 }}>
                      {n}
                    </span>
                    {sessions.length > 1 && (
                      <span style={{ position: 'absolute', bottom: 3, right: 4, font: "8px 'DM Mono', monospace", color: isSelected ? BG : ACCENT }}>
                        {sessions.length}
                      </span>
                    )}
                  </DwellArea>
                )
              })}
            </div>
          </div>

          {/* ── one session ── */}
          <div>
            {!selected ? (
              <div style={{ border: `1px solid ${LINE}`, padding: '30px 24px' }}>
                <Label style={{ color: 'rgba(245,244,239,0.45)' }}>Nothing logged yet</Label>
                <div style={{ marginTop: 10, fontSize: 14, color: 'rgba(245,244,239,0.5)', lineHeight: 1.6 }}>
                  Finish a workout and it lands here, with the calendar filling in as you go.
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <Label style={{ fontSize: 9 }}>{selected.day}</Label>
                  {daySessions.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <GestureTarget size={34} ariaLabel="previous session that day" onConfirm={() => cycle(-1)}>
                        <IconChevronL s={13} />
                      </GestureTarget>
                      <Label style={{ fontSize: 9, color: ACCENT }}>
                        {position + 1} / {daySessions.length}
                      </Label>
                      <GestureTarget size={34} ariaLabel="next session that day" onConfirm={() => cycle(1)}>
                        <IconChevronR s={13} />
                      </GestureTarget>
                    </div>
                  )}
                </div>

                {/* keyed so switching sessions replays the entry animation and
                    the panel visibly changes rather than swapping numbers */}
                <div
                  key={selected.id}
                  className="font-display"
                  style={{
                    fontWeight: 900, fontSize: 40, lineHeight: 0.94, textTransform: 'uppercase',
                    marginTop: 8, animation: 'titleIn 260ms ease-out both',
                  }}
                >
                  {selected.workoutName}
                </div>

                {/* a run has no volume and no sets, so it gets its own row */}
                <div style={{ display: 'flex', border: `1px solid ${LINE}`, marginTop: 16 }}>
                  {selected.run ? (
                    <>
                      {stat('Distance', selected.run.km.toFixed(1), 'km')}
                      {stat('Time', mmss(selected.seconds))}
                      {stat('Pace', fmtPace(selected.run.paceSec), '/ km')}
                    </>
                  ) : (
                    <>
                      {stat('Volume', selected.volumeKg.toLocaleString(), 'kg')}
                      {stat('Time', mmss(selected.seconds))}
                      {stat('Sets', String(selected.sets), `/ ${selected.targetSets}`)}
                    </>
                  )}
                </div>

                <div style={{ marginTop: 18 }}>
                  <Label style={{ fontSize: 9 }}>Worked</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
                    {selected.muscles.length === 0 ? (
                      <Label style={{ color: 'rgba(245,244,239,0.4)' }}>Nothing logged</Label>
                    ) : (
                      selected.muscles.map((m) => (
                        <span
                          key={m}
                          style={{
                            font: "10px 'DM Mono', monospace", letterSpacing: '0.14em', textTransform: 'uppercase',
                            padding: '6px 10px', border: `1px solid ${LINE_STRONG}`, color: 'rgba(245,244,239,0.75)',
                          }}
                        >
                          {m}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {selected.topArtist && (
                  <div style={{ marginTop: 18 }}>
                    <Label style={{ fontSize: 9 }}>Most played</Label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                      <div style={{ width: 54, height: 54, flexShrink: 0, border: `1px solid ${ACCENT}`, background: '#161310' }}>
                        {selected.topArtist.art && (
                          <img src={selected.topArtist.art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="font-display" style={{ fontWeight: 800, fontSize: 22, lineHeight: 1, textTransform: 'uppercase' }}>
                          {selected.topArtist.name}
                        </div>
                        <Label style={{ marginTop: 5, display: 'block', color: ACCENT }}>
                          {selected.topArtist.plays} track{selected.topArtist.plays === 1 ? '' : 's'}
                        </Label>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {totals.topArtist && (
              <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${LINE}` }}>
                <Label style={{ fontSize: 9 }}>Most played, all time</Label>
                <div className="font-display" style={{ fontWeight: 800, fontSize: 26, lineHeight: 1, textTransform: 'uppercase', marginTop: 8 }}>
                  {totals.topArtist.name}
                </div>
                <Label style={{ marginTop: 5, display: 'block', color: ACCENT }}>{totals.topArtist.plays} tracks</Label>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
