// Size buckets in px for the ImageBitmap cache (rendered at 1x, scaled via drawImage)
// These correspond roughly to 1.0 / 1.5 / 2.0 / 2.5 / 3.0 em at ~16px base
export const EMOJI_SIZE_BUCKETS = [24, 36, 48, 60, 72] as const

export const GRID_CELL_SIZE = 100
export const RAIN_PARTICLE_COUNT = 80
export const MIN_EMOJI_DISTANCE = 10

export const RAIN_CONFIG = {
  horizontalDrift: 0.6,
  minSpeed: 2,
  maxSpeed: 5,
  lineWidth: 0.8,
  minOpacity: 0.2,
  maxOpacity: 0.5,
  color: { r: 174, g: 194, b: 224 },
  lineMultiplier: 6,
} as const

export const COLOR_MAP: Record<string, string> = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
  pink: "#ec4899",
  brown: "#a16207",
}
