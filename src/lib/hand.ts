import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision'

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

/** Landmark indices from MediaPipe's 21-point hand model. */
const INDEX_TIP = 8
const THUMB_TIP = 4
const INDEX_PIP = 6
const MIDDLE_TIP = 12
const MIDDLE_PIP = 10

export type HandFrame = {
  /** Index fingertip, normalised 0..1 in *screen* space (already un-mirrored). */
  x: number
  y: number
  /** Thumb and index pinched together. */
  pinching: boolean
  /** Only the index finger extended: the "pointing" pose. */
  pointing: boolean
}

export async function createHandLandmarker(): Promise<HandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
    numHands: 1,
    runningMode: 'VIDEO',
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })
}

export function readFrame(result: HandLandmarkerResult): HandFrame | null {
  const hand = result.landmarks?.[0]
  if (!hand) return null

  const tip = hand[INDEX_TIP]
  const thumb = hand[THUMB_TIP]

  // The webcam feed is a mirror, so screen-x is the flip of landmark-x.
  const x = 1 - tip.x
  const y = tip.y

  const pinchDist = Math.hypot(tip.x - thumb.x, tip.y - thumb.y)

  // "Extended" = fingertip is above its middle joint in image space. Comparing
  // index against middle is what separates a deliberate point from an open palm.
  const indexUp = hand[INDEX_TIP].y < hand[INDEX_PIP].y
  const middleUp = hand[MIDDLE_TIP].y < hand[MIDDLE_PIP].y

  return {
    x,
    y,
    pinching: pinchDist < 0.06,
    pointing: indexUp && !middleUp,
  }
}
