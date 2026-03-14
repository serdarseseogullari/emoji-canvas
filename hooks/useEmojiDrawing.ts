import { useState, useRef, useCallback, useEffect } from "react"
import type { EmojiItem, Point, CanvasContext } from "@/types/canvas"
import { SpatialGrid } from "@/utils/SpatialGrid"
import { bucketSize, getOrCreateBitmap } from "@/utils/emojiHelpers"
import { MIN_EMOJI_DISTANCE } from "@/constants/canvas"

interface UseEmojiDrawingProps {
  currentEmoji: string
  spatialGrid: SpatialGrid
  ctxRef: React.RefObject<CanvasContext>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  dprRef: React.RefObject<number>
  visibleCellsRef: React.RefObject<Set<string>>
  needsRenderRef: React.RefObject<boolean>
}

export function useEmojiDrawing({
  currentEmoji,
  spatialGrid,
  ctxRef,
  canvasRef,
  dprRef,
  visibleCellsRef,
  needsRenderRef,
}: UseEmojiDrawingProps) {
  const [emojiCount, setEmojiCount] = useState(0)
  const emojisRef = useRef<EmojiItem[]>([])
  const nextId = useRef(0)
  const lastPosition = useRef<Point | null>(null)
  const rafRef = useRef<number | null>(null)
  const bitmapCacheRef = useRef<Map<string, ImageBitmap>>(new Map())

  const placeEmoji = useCallback(
    (clientX: number, clientY: number, containerRect: DOMRect) => {
      const x = clientX - containerRect.left
      const y = clientY - containerRect.top

      if (lastPosition.current) {
        const dx = x - lastPosition.current.x
        const dy = y - lastPosition.current.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance < MIN_EMOJI_DISTANCE) return
      }

      lastPosition.current = { x, y }

      const sizePx = bucketSize(Math.random() * 2 + 1)
      const newEmoji: EmojiItem = {
        id: nextId.current,
        emoji: currentEmoji,
        x,
        y,
        sizePx,
      }

      // Pre-warm the bitmap cache
      getOrCreateBitmap(currentEmoji, sizePx, bitmapCacheRef.current, () => {
        needsRenderRef.current = true
      })

      // Direct mutation for performance
      emojisRef.current.push(newEmoji)
      spatialGrid.add(newEmoji, emojisRef.current.length - 1)
      nextId.current += 1
      needsRenderRef.current = true

      setEmojiCount(emojisRef.current.length)
    },
    [currentEmoji, spatialGrid, needsRenderRef]
  )

  const clearCanvas = useCallback(() => {
    emojisRef.current = []
    spatialGrid.clear()
    nextId.current = 0
    needsRenderRef.current = true
    setEmojiCount(0)
  }, [spatialGrid, needsRenderRef])

  const renderCanvas = useCallback(() => {
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return

    const dpr = dprRef.current
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

    const emojis = emojisRef.current

    for (const cellKey of visibleCellsRef.current) {
      const emojiIndices = spatialGrid.getIndicesForCell(cellKey)
      for (const index of emojiIndices) {
        const emoji = emojis[index]
        if (!emoji) continue
        const bitmap = getOrCreateBitmap(emoji.emoji, emoji.sizePx, bitmapCacheRef.current, () => {
          needsRenderRef.current = true
        })
        if (!bitmap) continue
        const pad = Math.ceil(emoji.sizePx * 0.2)
        const dim = emoji.sizePx + pad * 2
        ctx.drawImage(bitmap, Math.round(emoji.x - dim / 2), Math.round(emoji.y - dim / 2))
      }
    }
  }, [ctxRef, canvasRef, dprRef, visibleCellsRef, spatialGrid, needsRenderRef])

  // Animation loop
  useEffect(() => {
    const animate = () => {
      if (needsRenderRef.current) {
        renderCanvas()
        needsRenderRef.current = false
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [renderCanvas, needsRenderRef])

  return {
    emojiCount,
    placeEmoji,
    clearCanvas,
    lastPosition,
  }
}
