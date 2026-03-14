import { EMOJI_SIZE_BUCKETS } from "@/constants/canvas"

// Pick the nearest bucket for a given em size
export function bucketSize(em: number): number {
  const px = em * 16
  let best: number = EMOJI_SIZE_BUCKETS[0]
  let bestDiff = Math.abs(px - best)
  for (const b of EMOJI_SIZE_BUCKETS) {
    const d = Math.abs(px - b)
    if (d < bestDiff) {
      bestDiff = d
      best = b
    }
  }
  return best
}

// Get or create an ImageBitmap for an emoji at a given pixel size.
// Returns null on first call (async creation in flight); returns cached bitmap thereafter.
export function getOrCreateBitmap(
  emoji: string,
  sizePx: number,
  cache: Map<string, ImageBitmap>,
  onReady: () => void
): ImageBitmap | null {
  const key = `${emoji}:${sizePx}`
  if (cache.has(key)) return cache.get(key)!

  // Not cached yet — kick off async creation and return null this frame
  const pad = Math.ceil(sizePx * 0.2)
  const dim = sizePx + pad * 2
  const oc = new OffscreenCanvas(dim, dim)
  const octx = oc.getContext("2d")!
  octx.font = `${sizePx}px serif`
  octx.textBaseline = "middle"
  octx.textAlign = "center"
  octx.fillText(emoji, dim / 2, dim / 2)
  createImageBitmap(oc).then((bmp) => {
    cache.set(key, bmp)
    onReady() // trigger a redraw once bitmap is ready
  })
  return null
}
