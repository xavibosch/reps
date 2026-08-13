import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import { createHandLandmarker, readFrame, type HandFrame } from '../lib/hand'
import { ACCENT, DwellButton, Label } from './ui'


/**
 * The hand does not get its own event system. It drives a virtual cursor that
 * dispatches ordinary pointer events at whatever sits under it, so every
 * control's existing hold-to-confirm logic works untouched.
 *
 * Two things matter for it to feel accurate:
 *
 * 1. The dot is positioned by writing `transform` straight to the DOM inside
 *    the tracking loop, never through React state. State would render a frame
 *    or more behind the hit test that runs in the same tick, so the dot you
 *    see and the element being pressed would disagree by tens of pixels.
 * 2. A dwell only begins once the hand has slowed down. Without that, sweeping
 *    across the panel presses whatever it passes over on the way.
 *
 * There is deliberately no swipe gesture. The index finger is the cursor, so a
 * quick move to the right is indistinguishable from a rightward swipe, and any
 * threshold that caught real swipes also caught ordinary cursor travel. The
 * on-screen arrows (dwell) and the keyboard arrows cover that job unambiguously.
 */

/** The hand comfortably covers only the middle of frame, so stretch it to fill the screen. */
const REACH = { x0: 0.18, x1: 0.82, y0: 0.16, y1: 0.84 }
const SMOOTH = 0.45
/** px/frame under which the cursor counts as parked and may start a dwell. */
const SETTLE_SPEED = 9

/**
 * Above every overlay in the app.
 *
 * The cursor used to sit at 100, under the summary (200), the leave dialog
 * (195) and the training log (190), so on those screens the hit test still
 * worked but the dot was painted behind the panel. With nothing to aim, the
 * hand looked broken. Anything added later must stay below this.
 */
const CURSOR_Z = 2147483000

const remap = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)))

const firePointer = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch' }),
  )

export function HandControl({ on, onFail }: { on: boolean; onFail?: (reason: string) => void }) {
  const [status, setStatus] = useState('off')

  const videoRef = useRef<HTMLVideoElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const onFailRef = useRef(onFail)
  onFailRef.current = onFail

  useEffect(() => {
    if (!on) {
      setStatus('off')
      return
    }

    let cancelled = false
    let raf = 0
    let landmarker: HandLandmarker | null = null
    let stream: MediaStream | null = null
    let lastVideoTime = -1

    const smooth = { x: 0.5, y: 0.5, has: false }
    let lastPx = 0
    let lastPy = 0
    let hovered: Element | null = null

    /**
     * `pointerleave` does not bubble, and React synthesises onPointerLeave from
     * `pointerout` rather than from a dispatched leave event. `pointercancel`
     * does bubble and lands directly on onPointerCancel, so send both.
     */
    const clearHover = () => {
      if (!hovered) return
      const el = hovered
      hovered = null
      firePointer(el, 'pointerout', 0, 0)
      firePointer(el, 'pointercancel', 0, 0)
    }

    const paint = (px: number, py: number, settled: boolean, visible: boolean) => {
      const el = cursorRef.current
      if (!el) return
      el.style.opacity = visible ? '1' : '0'
      // translate(-50%,-50%) after the move keeps the dot centred on the point
      // even as it grows, which a fixed pixel margin would not
      el.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`
      el.style.width = settled ? '34px' : '26px'
      el.style.height = settled ? '34px' : '26px'
      el.style.borderColor = settled ? ACCENT : 'rgba(214,48,34,0.55)'
    }

    const start = async () => {
      /**
       * Camera and model are requested in the same tick, not one after the
       * other. The model is ~8 MB off a CDN, so asking for it first meant the
       * permission prompt only appeared a second or two after the page loaded
       * and the app looked dead in the meantime. Started together, the prompt
       * is immediate and the download happens while the webcam warms up.
       *
       * Both promises get a no-op catch straight away: an early rejection with
       * nothing attached yet counts as an unhandled rejection, even though the
       * awaits below do handle it.
       */
      const camera = navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      })
      camera.catch(() => {})
      const model = createHandLandmarker()
      model.catch(() => {})

      try {
        setStatus('opening camera')
        stream = await camera
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          model.then((m) => m.close()).catch(() => {})
          return
        }

        const video = videoRef.current!
        video.srcObject = stream
        await video.play()

        setStatus('loading model')
        landmarker = await model
        // the effect may have torn down while the model was still downloading
        if (cancelled) {
          landmarker.close()
          landmarker = null
          return
        }

        setStatus('tracking')
        raf = requestAnimationFrame(loop)
      } catch (e) {
        if (cancelled) return
        const err = e as Error
        // A denied prompt is not a bug, and the generic message does not say
        // what to do about it, so name it plainly and hand it to the caller.
        const reason =
          err.name === 'NotAllowedError'
            ? 'camera blocked in the browser'
            : err.name === 'NotFoundError'
              ? 'no camera found'
              : err.message
        setStatus(reason)
        onFailRef.current?.(reason)
      }
    }

    const loop = () => {
      const video = videoRef.current
      if (cancelled || !landmarker || !video || video.readyState < 2) {
        raf = requestAnimationFrame(loop)
        return
      }

      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime
        let frame: HandFrame | null = null
        try {
          frame = readFrame(landmarker.detectForVideo(video, performance.now()))
        } catch {
          /* a dropped frame is not worth tearing the loop down */
        }

        if (!frame) {
          clearHover()
          smooth.has = false
          paint(lastPx, lastPy, false, false)
        } else {
          const nx = remap(frame.x, REACH.x0, REACH.x1)
          const ny = remap(frame.y, REACH.y0, REACH.y1)
          if (!smooth.has) {
            smooth.x = nx
            smooth.y = ny
            smooth.has = true
          } else {
            smooth.x += (nx - smooth.x) * SMOOTH
            smooth.y += (ny - smooth.y) * SMOOTH
          }

          const px = smooth.x * window.innerWidth
          const py = smooth.y * window.innerHeight
          const speed = Math.hypot(px - lastPx, py - lastPy)
          lastPx = px
          lastPy = py

          const settled = speed < SETTLE_SPEED
          // painted from the exact coordinates the hit test is about to use
          paint(px, py, settled, true)

          const target = (document.elementFromPoint(px, py) as Element | null)?.closest('button') ?? null

          /* ── dwell: only once the hand has parked on the control ── */
          if (target !== hovered) {
            // moving off the old target always releases it
            clearHover()
            // but a new dwell only starts when the hand is no longer sweeping
            if (target && settled) {
              firePointer(target, 'pointerdown', px, py)
              hovered = target
            }
          }
        }
      }
      raf = requestAnimationFrame(loop)
    }

    start()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearHover()
      stream?.getTracks().forEach((t) => t.stop())
      landmarker?.close()
    }
  }, [on])

  return (
    <>

      {/* Portalled to <body> on purpose.
          The app frame carries a `transform` to scale 1440x900 into the window,
          and a transformed ancestor becomes the containing block for its
          `position: fixed` descendants. Left inside the frame, the cursor was
          laid out in the frame's scaled local space while elementFromPoint
          read viewport space, so the dot sat ~100px away from whatever it was
          actually pressing. Rendering outside the frame puts both back in the
          same coordinate system. */}
      {createPortal(
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            /* Kept mounted and playing but fully transparent: MediaPipe reads
               frames straight off this element, and display:none would stop it
               decoding. Invisible costs nothing and frees the corner. */
            style={{
              position: 'fixed', right: 12, bottom: 12, width: 152, height: 114,
              objectFit: 'cover', transform: 'scaleX(-1)',
              opacity: 0, pointerEvents: 'none', zIndex: -1,
            }}
          />

          {on && (
            <div style={{ position: 'fixed', left: 12, bottom: 132, zIndex: CURSOR_Z - 1, pointerEvents: 'none' }}>
              <Label style={{ color: status === 'tracking' ? ACCENT : 'rgba(245,244,239,0.5)' }}>{status}</Label>
            </div>
          )}

          {/* Positioned by the tracking loop, never by React state. */}
          <div
            ref={cursorRef}
            style={{
              position: 'fixed', left: 0, top: 0, width: 26, height: 26,
              borderRadius: '50%', border: `2px solid ${ACCENT}`,
              background: 'rgba(214,48,34,0.18)', boxShadow: '0 0 18px rgba(214,48,34,0.55)',
              pointerEvents: 'none', zIndex: CURSOR_Z, opacity: 0,
              transition: 'width 90ms, height 90ms, border-color 90ms',
              display: on ? 'block' : 'none',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, margin: 'auto', width: 5, height: 5, borderRadius: '50%', background: ACCENT }} />
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

/** The toggle, separate from the engine so each screen can place its own. */
export function HandToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <DwellButton ariaLabel="toggle hand control" active={on} onConfirm={onToggle}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: on ? ACCENT : 'rgba(245,244,239,0.35)' }} />
      Hand
    </DwellButton>
  )
}
