"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Shuffle, Moon, Sun, Trash2 } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { colorCategories, getRandomEmoji } from "@/lib/emoji-utils"

// Size buckets in px for the ImageBitmap cache (rendered at 1x, scaled via drawImage)
// These correspond roughly to 1.0 / 1.5 / 2.0 / 2.5 / 3.0 em at ~16px base
const EMOJI_SIZE_BUCKETS = [24, 36, 48, 60, 72]

// Pick the nearest bucket for a given em size
function bucketSize(em: number): number {
  const px = em * 16
  let best = EMOJI_SIZE_BUCKETS[0]
  let bestDiff = Math.abs(px - best)
  for (const b of EMOJI_SIZE_BUCKETS) {
    const d = Math.abs(px - b)
    if (d < bestDiff) { bestDiff = d; best = b }
  }
  return best
}

// Define emoji type
interface EmojiItem {
  id: number
  emoji: string
  x: number
  y: number
  sizePx: number  // bucketed pixel size — used as drawImage dimension & cache key
}

// Rain particle types for tears in rain effect
interface RainParticle {
  x: number
  y: number
  vx: number
  vy: number
  length: number
  color: string
}


export default function EmojiCanvas() {
  const [currentEmoji, setCurrentEmoji] = useState<string>("😀")
  const [isShuffleMode, setIsShuffleMode] = useState<boolean>(true)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState<boolean>(false)
  const [emojiCount, setEmojiCount] = useState(0)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rainCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const emojisRef = useRef<EmojiItem[]>([])
  const nextId = useRef(0)
  const lastPosition = useRef<{ x: number; y: number } | null>(null)
  const rafRef = useRef<number | null>(null)
  const rainRafRef = useRef<number | null>(null)
  const needsRenderRef = useRef(true)
  const visibleCellsRef = useRef<Set<string>>(new Set())
  const spatialGridRef = useRef<Map<string, number[]>>(new Map())
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const rainCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const rainParticlesRef = useRef<RainParticle[]>([])
  // ImageBitmap cache: key = "emoji:sizePx"
  const bitmapCacheRef = useRef<Map<string, ImageBitmap>>(new Map())

  const dprRef = useRef(1)
  const gridCellSize = 100
  const RAIN_PARTICLE_COUNT = 80

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize rain particles — staggered across the canvas so rain doesn't all start at top
  const initRainDrops = useCallback((width: number, height: number) => {
    const particles: RainParticle[] = []
    for (let i = 0; i < RAIN_PARTICLE_COUNT; i++) {
      const length = Math.random() * 0.9 + 0.1
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height, // stagger initial y so rain appears immediately
        vx: (Math.random() - 0.5) * 0.6, // very slight horizontal drift
        vy: Math.random() * 3 + 2,        // slow: 2–5 px/frame (lo-fi feel)
        length,
        color: `rgba(174, 194, 224, ${Math.random() * 0.3 + 0.2})`, // 0.2–0.5 opacity
      })
    }
    rainParticlesRef.current = particles
  }, [RAIN_PARTICLE_COUNT])

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const rainCanvas = rainCanvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      if (canvas && containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        dprRef.current = dpr
        canvas.width = width * dpr
        canvas.height = height * dpr
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`

        const ctx = canvas.getContext("2d", {
          alpha: true,
          desynchronized: true,
        })
        if (ctx) {
          ctx.scale(dpr, dpr)
          ctx.textBaseline = "middle"
          ctx.textAlign = "center"
          ctxRef.current = ctx
        }

        // Initialize rain canvas
        if (rainCanvas) {
          rainCanvas.width = width * dpr
          rainCanvas.height = height * dpr
          rainCanvas.style.width = `${width}px`
          rainCanvas.style.height = `${height}px`

          const rainCtx = rainCanvas.getContext("2d", {
            alpha: true,
            desynchronized: true,
          })
          if (rainCtx) {
            rainCtx.scale(dpr, dpr)
            rainCtxRef.current = rainCtx
          }
        }

        initRainDrops(width, height)
        updateVisibleCells(width, height)
        needsRenderRef.current = true
      }
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [initRainDrops])

  // Render rain effect — two-layer system: fine streaks + gradient light shafts
  const renderRain = useCallback(() => {
    const ctx = rainCtxRef.current
    const canvas = rainCanvasRef.current
    if (!ctx || !canvas) return

    const dpr = dprRef.current
    const width = canvas.width / dpr
    const height = canvas.height / dpr

    ctx.clearRect(0, 0, width, height)

    // Fine rain streaks with slight angle
    ctx.lineWidth = 0.8
    for (const p of rainParticlesRef.current) {
      ctx.strokeStyle = p.color
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x + p.length * p.vx * 6, p.y + p.length * p.vy * 6)
      ctx.stroke()

      p.x += p.vx
      p.y += p.vy
      if (p.y > height) {
        p.y = -p.length * 6
        p.x = Math.random() * width
      }
    }
  }, [])

  // Add emoji to spatial grid (incremental update)
  const addToSpatialGrid = useCallback((emoji: EmojiItem, index: number) => {
    const cellX = Math.floor(emoji.x / gridCellSize)
    const cellY = Math.floor(emoji.y / gridCellSize)
    const cellKey = `${cellX},${cellY}`

    if (!spatialGridRef.current.has(cellKey)) {
      spatialGridRef.current.set(cellKey, [])
    }
    spatialGridRef.current.get(cellKey)!.push(index)
  }, [])

  // Rebuild entire spatial grid
  const rebuildSpatialGrid = useCallback(() => {
    spatialGridRef.current.clear()
    const emojis = emojisRef.current
    for (let i = 0; i < emojis.length; i++) {
      const emoji = emojis[i]
      const cellX = Math.floor(emoji.x / gridCellSize)
      const cellY = Math.floor(emoji.y / gridCellSize)
      const cellKey = `${cellX},${cellY}`

      if (!spatialGridRef.current.has(cellKey)) {
        spatialGridRef.current.set(cellKey, [])
      }
      spatialGridRef.current.get(cellKey)!.push(i)
    }
  }, [])

  const updateVisibleCells = (width: number, height: number) => {
    const startCellX = Math.floor(0 / gridCellSize) - 1
    const startCellY = Math.floor(0 / gridCellSize) - 1
    const endCellX = Math.ceil(width / gridCellSize) + 1
    const endCellY = Math.ceil(height / gridCellSize) + 1

    const visibleCells = new Set<string>()

    for (let y = startCellY; y <= endCellY; y++) {
      for (let x = startCellX; x <= endCellX; x++) {
        visibleCells.add(`${x},${y}`)
      }
    }

    visibleCellsRef.current = visibleCells
  }

  // Get or create an ImageBitmap for an emoji at a given pixel size.
  // Rendering is synchronous via OffscreenCanvas + createImageBitmap (async, fires and caches).
  // Returns null on first call for a new combo (async creation in flight); returns cached bitmap thereafter.
  const getOrCreateBitmap = useCallback((emoji: string, sizePx: number): ImageBitmap | null => {
    const key = `${emoji}:${sizePx}`
    const cache = bitmapCacheRef.current
    if (cache.has(key)) return cache.get(key)!

    // Not cached yet — kick off async creation and return null this frame
    // (will be drawn from cache on the next dirty render)
    const pad = Math.ceil(sizePx * 0.2)
    const dim = sizePx + pad * 2
    const oc = new OffscreenCanvas(dim, dim)
    const octx = oc.getContext("2d")!
    octx.font = `${sizePx}px serif`
    octx.textBaseline = "middle"
    octx.textAlign = "center"
    octx.fillText(emoji, dim / 2, dim / 2)
    createImageBitmap(oc).then(bmp => {
      cache.set(key, bmp)
      needsRenderRef.current = true   // trigger a redraw once bitmap is ready
    })
    return null
  }, [])

  // Render all emojis using cached ImageBitmaps — drawImage is a GPU blit, no font system involvement
  const renderCanvas = useCallback(() => {
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return

    const dpr = dprRef.current
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

    const emojis = emojisRef.current

    for (const cellKey of visibleCellsRef.current) {
      const emojiIndices = spatialGridRef.current.get(cellKey) || []
      for (const index of emojiIndices) {
        const emoji = emojis[index]
        if (!emoji) continue
        const bitmap = getOrCreateBitmap(emoji.emoji, emoji.sizePx)
        if (!bitmap) continue  // being created async, will re-render when ready
        const pad = Math.ceil(emoji.sizePx * 0.2)
        const dim = emoji.sizePx + pad * 2
        // Centre the bitmap on the emoji's x,y position
        ctx.drawImage(bitmap, Math.round(emoji.x - dim / 2), Math.round(emoji.y - dim / 2))
      }
    }
  }, [getOrCreateBitmap])

  // Animation loop - only redraws when dirty (both light and dark mode)
  useEffect(() => {
    const animate = () => {
      if (needsRenderRef.current) {
        renderCanvas()
        needsRenderRef.current = false
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [renderCanvas])

  // Rain loop - independent of emoji count so speed never degrades
  useEffect(() => {
    // Don't start rain animation until component is mounted and theme is resolved
    if (!mounted || theme !== "dark") {
      if (rainRafRef.current) cancelAnimationFrame(rainRafRef.current)
      return
    }

    const animateRain = () => {
      renderRain()
      rainRafRef.current = requestAnimationFrame(animateRain)
    }

    rainRafRef.current = requestAnimationFrame(animateRain)
    return () => { if (rainRafRef.current) cancelAnimationFrame(rainRafRef.current) }
  }, [mounted, theme, renderRain])

  // Prevent scrolling on mobile when interacting with canvas
  useEffect(() => {
    const preventDefault = (e: TouchEvent) => {
      if (containerRef.current?.contains(e.target as Node)) {
        e.preventDefault()
      }
    }

    document.addEventListener("touchmove", preventDefault, { passive: false })
    return () => document.removeEventListener("touchmove", preventDefault)
  }, [])

  const placeEmoji = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    if (lastPosition.current) {
      const dx = x - lastPosition.current.x
      const dy = y - lastPosition.current.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < 10) return
    }

    lastPosition.current = { x, y }

    const sizePx = bucketSize(Math.random() * 2 + 1)
    const newEmoji: EmojiItem = { id: nextId.current, emoji: currentEmoji, x, y, sizePx }
    // Pre-warm the bitmap cache so it's ready before the next render
    getOrCreateBitmap(currentEmoji, sizePx)

    // Direct mutation for performance - no re-render needed
    emojisRef.current.push(newEmoji)
    addToSpatialGrid(newEmoji, emojisRef.current.length - 1)
    nextId.current += 1
    needsRenderRef.current = true

    // Update count for UI display (debounced via batching)
    setEmojiCount(emojisRef.current.length)
  }, [currentEmoji, addToSpatialGrid, getOrCreateBitmap])

  const clearCanvas = useCallback(() => {
    emojisRef.current = []
    spatialGridRef.current.clear()
    nextId.current = 0
    needsRenderRef.current = true
    setEmojiCount(0)
  }, [])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDrawing(true)
    lastPosition.current = null
    placeEmoji(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing) return
    placeEmoji(e.clientX, e.clientY)
  }

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false)
    lastPosition.current = null

    if (isShuffleMode) {
      setCurrentEmoji(getRandomEmoji())
    } else if (selectedColor) {
      setCurrentEmoji(getRandomEmoji(selectedColor))
    }
  }, [isShuffleMode, selectedColor])

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDrawing(true)
    lastPosition.current = null
    if (e.touches.length > 0) {
      placeEmoji(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDrawing) return
    if (e.touches.length > 0) {
      placeEmoji(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

  const handleTouchEnd = useCallback(() => {
    setIsDrawing(false)
    lastPosition.current = null

    if (isShuffleMode) {
      setCurrentEmoji(getRandomEmoji())
    } else if (selectedColor) {
      setCurrentEmoji(getRandomEmoji(selectedColor))
    }
  }, [isShuffleMode, selectedColor])

  const handleColorSelect = (color: string) => {
    setSelectedColor(color)
    setCurrentEmoji(getRandomEmoji(color))
  }

  const toggleShuffleMode = () => {
    setIsShuffleMode(!isShuffleMode)
    if (!isShuffleMode && !selectedColor) {
      setSelectedColor(Object.keys(colorCategories)[0])
    }
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Title */}
      {mounted && (
        <svg
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-8deg] z-0 select-none pointer-events-none overflow-visible transition-all duration-500"
          style={{ width: "min(90vw, 640px)", height: "auto" }}
          viewBox="0 0 600 120"
          xmlns="http://www.w3.org/2000/svg"
        >
          {theme !== "dark" && (
            <>
              {/* Depth shadow layers rendered first (back) */}
              {[6,5,4,3,2].map(i => (
                <text
                  key={i}
                  x={300 + i}
                  y={90 + i}
                  textAnchor="middle"
                  fontFamily="Damion, cursive"
                  fontSize="90"
                  fill="black"
                >
                  Emoji Canvas
                </text>
              ))}
            </>
          )}
          {/* Main text — in dark mode: ghost style; in light mode: white with black stroke */}
          <text
            x="300"
            y="90"
            textAnchor="middle"
            fontFamily="Damion, cursive"
            fontSize="90"
            fill={theme === "dark" ? "rgba(100,100,120,0.15)" : "white"}
            stroke={theme === "dark" ? "rgba(100,100,120,0.25)" : "black"}
            strokeWidth={theme === "dark" ? "1" : "5"}
            strokeLinejoin="round"
            style={{ paintOrder: "stroke fill" }}
          >
            Emoji Canvas
          </text>
        </svg>
      )}

      {/* Custom cursor - only show on non-touch devices */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Damion&display=swap');

        @media (hover: hover) {
          body {
            cursor: none;
          }
          .emoji-cursor {
            pointer-events: none;
            position: fixed;
            transform: translate(-50%, -50%);
            z-index: 9999;
            font-size: 2em;
          }
        }
        /* Prevent pull-to-refresh and overscroll behaviors */
        html, body {
          overscroll-behavior: none;
          overflow: hidden;
          position: fixed;
          width: 100%;
          height: 100%;
        }
        
        /* Hardware acceleration */
        canvas {
          transform: translateZ(0);
          backface-visibility: hidden;
          perspective: 1000;
          will-change: transform;
        }
      `}</style>

      <div
        ref={containerRef}
        className="h-full w-full touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
        {/* Rain canvas for tears in rain mode - only visible in dark mode */}
        <canvas
          ref={rainCanvasRef}
          className={cn(
            "absolute top-0 left-0 w-full h-full pointer-events-none transition-opacity duration-500",
            theme === "dark" ? "opacity-100" : "opacity-0"
          )}
        />
      </div>

      {/* Emoji cursor - only visible on desktop */}
      <EmojiCursor emoji={currentEmoji} />

      {/* Floating control bar */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-full shadow-lg p-2 flex items-center gap-2 z-10">
        <Button
          variant="ghost"
          size="icon"
          className={cn("rounded-full", isShuffleMode ? "bg-primary/20 text-primary" : "text-muted-foreground")}
          onClick={toggleShuffleMode}
          aria-label={isShuffleMode ? "Disable shuffle mode" : "Enable shuffle mode"}
        >
          <Shuffle className="h-5 w-5" />
        </Button>

        {!isShuffleMode && (
          <div className="flex items-center gap-1 px-2">
            {Object.entries(colorCategories).map(([color, _]) => (
              <button
                key={color}
                className={cn(
                  "w-8 h-8 rounded-full transition-transform",
                  selectedColor === color ? "scale-110 ring-2 ring-primary ring-offset-2" : "",
                )}
                style={{ backgroundColor: getColorHex(color) }}
                onClick={() => handleColorSelect(color)}
                aria-label={`Select ${color} color`}
              />
            ))}
          </div>
        )}

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground hover:text-destructive"
          onClick={clearCanvas}
          aria-label="Clear canvas"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>

      {/* Dark mode toggle - top right corner */}
      {mounted && (
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 right-4 z-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border-2 cursor-pointer transition-all duration-300 hover:scale-110 hover:shadow-xl dark:hover:shadow-[0_0_20px_rgba(250,204,21,0.4)] hover:shadow-gray-400/50"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5 text-yellow-500" />
          ) : (
            <Moon className="h-5 w-5 text-gray-700" />
          )}
        </Button>
      )}

      {/* Emoji count display */}
      {emojiCount > 0 && (
        <div className="fixed top-4 left-4 z-10 bg-white dark:bg-gray-800 rounded-full shadow-lg px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-300">
          {emojiCount.toLocaleString()} {theme === "dark" ? "tears in rain" : "emojis"}
        </div>
      )}
    </div>
  )
}

// Emoji cursor component - only shown on desktop
function EmojiCursor({ emoji }: { emoji: string }) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => {
    // Check if we're on a touch device
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0)

    const updatePosition = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener("mousemove", updatePosition)
    return () => window.removeEventListener("mousemove", updatePosition)
  }, [])

  if (isTouchDevice) return null

  return (
    <div
      className="emoji-cursor"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {emoji}
    </div>
  )
}

// Helper function to get color hex values for the palette
function getColorHex(color: string): string {
  const colorMap: Record<string, string> = {
    red: "#ef4444",
    orange: "#f97316",
    yellow: "#eab308",
    green: "#22c55e",
    blue: "#3b82f6",
    purple: "#a855f7",
    pink: "#ec4899",
    brown: "#a16207",
  }

  return colorMap[color] || "#000000"
}
