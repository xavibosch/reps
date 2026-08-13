import type { QueueTrack } from '../lib/spotify'
import { ACCENT, LINE_STRONG } from './ui'

/**
 * Fanned album carousel: the current track sits centred and lit, with recent
 * history fanning left and the upcoming queue fanning right.
 *
 * Slots are fixed positions, not a list. Whatever track occupies slot 0 is
 * "now playing", which keeps the 3D transforms stable while the tracks shift
 * beneath them. Artwork is keyed by track id so React remounts it on a song
 * change and the mount animation plays exactly once per song.
 */
export function Coverflow({
  recent,
  upcoming,
  size = 170,
}: {
  recent: QueueTrack[]
  upcoming: QueueTrack[]
  size?: number
}) {
  const slots: { d: number; t?: QueueTrack }[] = [
    { d: -2, t: recent[1] },
    { d: -1, t: recent[0] },
    { d: 0, t: upcoming[0] },
    { d: 1, t: upcoming[1] },
    { d: 2, t: upcoming[2] },
  ]

  const side = Math.round(size * 0.78)
  const gap = Math.round(size * 0.54)

  return (
    <div style={{ position: 'relative', height: size + 12, perspective: 1200, display: 'grid', placeItems: 'center' }}>
      {slots.map(({ d, t }) => {
        const isCenter = d === 0
        const box = isCenter ? size : side
        return (
          <div
            key={d}
            style={{
              position: 'absolute',
              width: box,
              height: box,
              transformStyle: 'preserve-3d',
              transform: `translateX(${d * gap}px) rotateY(${-d * 36}deg) scale(${isCenter ? 1 : 0.88})`,
              transition: 'transform 420ms cubic-bezier(0.16,1,0.3,1), opacity 420ms',
              opacity: t ? (isCenter ? 1 : Math.abs(d) === 1 ? 0.5 : 0.22) : 0.07,
              zIndex: 10 - Math.abs(d),
              border: isCenter ? `1px solid ${ACCENT}` : `1px solid ${LINE_STRONG}`,
              background: '#161310',
              animation: isCenter && t ? 'glowPulse 700ms ease-out both' : undefined,
            }}
          >
            {t?.art && (
              <img
                key={t.id}
                src={t.art}
                alt={isCenter ? `${t.title} by ${t.artist}` : ''}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: isCenter ? 'none' : 'grayscale(1) brightness(0.55)',
                  animation: isCenter ? 'coverIn 520ms ease-out both' : undefined,
                }}
              />
            )}
            {isCenter && t && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 9,
                  left: 9,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(12,11,9,0.72)',
                  padding: '5px 8px',
                  border: `1px solid ${LINE_STRONG}`,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 11 }}>
                  <i style={{ width: 2, height: 6, background: ACCENT, animation: 'eq 0.7s ease-in-out infinite alternate' }} />
                  <i style={{ width: 2, height: 11, background: ACCENT, animation: 'eq 0.5s ease-in-out infinite alternate' }} />
                  <i style={{ width: 2, height: 4, background: ACCENT, animation: 'eq 0.6s ease-in-out infinite alternate' }} />
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
