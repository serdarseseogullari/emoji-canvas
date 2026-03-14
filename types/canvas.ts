export interface EmojiItem {
  id: number
  emoji: string
  x: number
  y: number
  sizePx: number // bucketed pixel size — used as drawImage dimension & cache key
}

export interface RainParticle {
  x: number
  y: number
  vx: number
  vy: number
  length: number
  color: string
}

export type Point = { x: number; y: number }
export type CanvasContext = CanvasRenderingContext2D | null
