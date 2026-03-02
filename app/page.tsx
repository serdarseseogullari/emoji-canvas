"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Shuffle, Moon, Sun, Trash2 } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { colorCategories, getRandomEmoji } from "@/lib/emoji-utils"

// Define emoji type
interface EmojiItem {
  id: number
  emoji: string
  x: number
  y: number
  size: number
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

interface ThroughParticle {
  x: number
  y: number
  vy: number
  length: number
  opacity: number
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
  const countUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const needsRenderRef = useRef(true)
  const visibleCellsRef = useRef<Set<string>>(new Set())
  const spatialGridRef = useRef<Map<string, number[]>>(new Map())
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const rainCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const rainParticlesRef = useRef<RainParticle[]>([])
  const throughParticlesRef = useRef<ThroughParticle[]>([])
  const dprRef = useRef(1)
  const gridCellSize = 100
  const RAIN_PARTICLE_COUNT = 80
  const THROUGH_PARTICLE_COUNT = 30

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

    const through: ThroughParticle[] = []
    for (let i = 0; i < THROUGH_PARTICLE_COUNT; i++) {
      const length = Math.random() * 400 + 60
      through.push({
        x: Math.random() * width,
        y: Math.random() * height,         // stagger too
        vy: Math.random() * 2 + 1,         // very slow: 1–3 px/frame
        length,
        opacity: Math.random() * 0.07 + 0.02, // subtle: 0.02–0.09
      })
    }
    throughParticlesRef.current = through
  }, [RAIN_PARTICLE_COUNT, THROUGH_PARTICLE_COUNT])

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

    // Layer 1: through-particles — tall vertical streaks, flat colour (no gradient per frame)
    ctx.lineWidth = 1
    ctx.lineCap = "butt"
    for (const p of throughParticlesRef.current) {
      ctx.strokeStyle = `rgba(200,220,255,${p.opacity})`
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x, p.y + p.length)
      ctx.stroke()

      p.y += p.vy
      if (p.y > height) {
        p.y = -p.length
        p.x = Math.random() * width
      }
    }

    // Layer 2: fine rain streaks with slight angle
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

  // Optimized render - batch font changes, with fade support for dark mode
  const renderCanvas = useCallback(() => {
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return

    const dpr = dprRef.current
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

    const emojis = emojisRef.current

    // Group emojis by size for batch font setting (minimises expensive ctx.font changes)
    const sizeGroups = new Map<number, number[]>()

    for (const cellKey of visibleCellsRef.current) {
      const emojiIndices = spatialGridRef.current.get(cellKey) || []
      for (const index of emojiIndices) {
        if (!emojis[index]) continue
        const sizeKey = Math.round(emojis[index].size * 10)
        if (!sizeGroups.has(sizeKey)) sizeGroups.set(sizeKey, [])
        sizeGroups.get(sizeKey)!.push(index)
      }
    }

    for (const [sizeKey, indices] of sizeGroups) {
      ctx.font = `${sizeKey / 10}em serif`
      for (const index of indices) {
        const emoji = emojis[index]
        ctx.fillText(emoji.emoji, emoji.x, emoji.y)
      }
    }
  }, [theme])

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
    if (theme !== "dark") {
      if (rainRafRef.current) cancelAnimationFrame(rainRafRef.current)
      return
    }

    const animateRain = () => {
      renderRain()
      rainRafRef.current = requestAnimationFrame(animateRain)
    }

    rainRafRef.current = requestAnimationFrame(animateRain)
    return () => { if (rainRafRef.current) cancelAnimationFrame(rainRafRef.current) }
  }, [theme, renderRain])

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

    const size = Math.random() * 2 + 1
    const newEmoji: EmojiItem = { id: nextId.current, emoji: currentEmoji, x, y, size }

    // Direct mutation for performance - no re-render needed
    emojisRef.current.push(newEmoji)
    addToSpatialGrid(newEmoji, emojisRef.current.length - 1)
    nextId.current += 1
    needsRenderRef.current = true

    // Throttle count update — React re-renders on every call, which blocks the main thread
    if (!countUpdateTimerRef.current) {
      countUpdateTimerRef.current = setTimeout(() => {
        setEmojiCount(emojisRef.current.length)
        countUpdateTimerRef.current = null
      }, 100)
    }
  }, [currentEmoji, addToSpatialGrid])

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
