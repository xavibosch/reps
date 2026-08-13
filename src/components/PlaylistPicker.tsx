import type { Playlist } from '../lib/spotify'
import { ACCENT, LINE_STRONG, DwellArea, Label, Overlay } from './ui'

/**
 * Starts a playlist on whichever device is already active. The app never
 * streams audio itself, so "switching playlist" is just handing Spotify a
 * context uri to play.
 *
 * Tiles show artwork only: mid-workout you recognise a playlist by its cover
 * far faster than by reading its name, and the name is what made the grid
 * noisy. The name still rides along as the accessible label.
 */
export function PlaylistPicker({
  playlists,
  onPick,
  onClose,
}: {
  playlists: Playlist[]
  onPick: (uri: string) => void
  onClose: () => void
}) {
  return (
    <Overlay title="Playlists" onClose={onClose} width={780}>
      {playlists.length === 0 ? (
        <Label style={{ display: 'block', textAlign: 'center', padding: '30px 0', textTransform: 'none', letterSpacing: '0.08em' }}>
          No playlists loaded. If you connected before playlist access was added, disconnect and connect again to grant it.
        </Label>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {playlists.map((pl) => (
            <DwellArea
              key={pl.id}
              ariaLabel={`play ${pl.name}`}
              onConfirm={() => onPick(pl.uri)}
              style={{ aspectRatio: '1', background: '#161310' }}
            >
              {pl.art ? (
                <img src={pl.art} alt={pl.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <span
                  className="font-display"
                  style={{
                    position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                    padding: 8, textAlign: 'center', fontWeight: 700, fontSize: 14,
                    textTransform: 'uppercase', color: 'rgba(245,244,239,0.5)',
                  }}
                >
                  {pl.name}
                </span>
              )}
              <span
                style={{
                  position: 'absolute', inset: 0,
                  border: `1px solid ${LINE_STRONG}`,
                  boxShadow: `inset 0 -40px 40px -30px rgba(12,11,9,0.85)`,
                  pointerEvents: 'none',
                }}
              />
              <span style={{ position: 'absolute', top: 6, left: 6, width: 5, height: 5, background: ACCENT }} />
            </DwellArea>
          ))}
        </div>
      )}
    </Overlay>
  )
}
