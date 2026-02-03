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
  createdAt: number // timestamp for fade effect
}

// Rain drop type for tears in rain effect
interface RainDrop {
  x: number
  y: number
  speed: number
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
  const needsRenderRef = useRef(true)
  const visibleCellsRef = useRef<Set<string>>(new Set())
  const spatialGridRef = useRef<Map<string, number[]>>(new Map())
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const rainCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const rainDropsRef = useRef<RainDrop[]>([])
  const dprRef = useRef(1)
  const gridCellSize = 100
  const EMOJI_FADE_DURATION = 15000 // 15 seconds fade in dark mode
  const RAIN_DROP_COUNT = 100

  // Handle hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize rain drops
  const initRainDrops = useCallback((width: number, height: number) => {
    const drops: RainDrop[] = []
    for (let i = 0; i < RAIN_DROP_COUNT; i++) {
      drops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: Math.random() * 2 + 1,
        length: Math.random() * 15 + 10,
        opacity: Math.random() * 0.03 + 0.01, // Very low opacity: 0.01-0.04
      })
    }
    rainDropsRef.current = drops
  }, [])

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

  // Render rain effect
  const renderRain = useCallback(() => {
    const ctx = rainCtxRef.current
    const canvas = rainCanvasRef.current
    if (!ctx || !canvas) return

    const dpr = dprRef.current
    const width = canvas.width / dpr
    const height = canvas.height / dpr

    ctx.clearRect(0, 0, width, height)

    // Draw rain drops
    for (const drop of rainDropsRef.current) {
      ctx.beginPath()
      ctx.moveTo(drop.x, drop.y)
      ctx.lineTo(drop.x + 0.5, drop.y + drop.length)
      ctx.strokeStyle = `rgba(150, 180, 255, ${drop.opacity})`
      ctx.lineWidth = 1
      ctx.stroke()

      // Move drop down
      drop.y += drop.speed

      // Reset drop when it goes off screen
      if (drop.y > height) {
        drop.y = -drop.length
        drop.x = Math.random() * width
      }
    }
  }, [])

  // Animation loop - handles rendering and rain
  useEffect(() => {
    const isDarkMode = theme === "dark"

    const animate = () => {
      const now = Date.now()

      // In dark mode, continuously render for rain and fading
      if (isDarkMode) {
        // Check for expired emojis and trigger re-render
        const emojis = emojisRef.current
        let hasExpired = false

        for (let i = emojis.length - 1; i >= 0; i--) {
          const age = now - emojis[i].createdAt
          if (age > EMOJI_FADE_DURATION + 2000) {
            // Remove fully faded emojis
            hasExpired = true
          }
        }

        if (hasExpired) {
          // Rebuild spatial grid after removing old emojis
          const newEmojis = emojis.filter(e => now - e.createdAt <= EMOJI_FADE_DURATION + 2000)
          emojisRef.current = newEmojis
          rebuildSpatialGrid()
          setEmojiCount(newEmojis.length)
        }

        renderCanvas()
        renderRain()
      } else if (needsRenderRef.current) {
        renderCanvas()
        needsRenderRef.current = false
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [theme, renderRain])

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
    const isDarkMode = theme === "dark"
    const now = Date.now()

    // Group emojis by size for batch font setting
    const sizeGroups = new Map<number, { index: number; opacity: number }[]>()

    for (const cellKey of visibleCellsRef.current) {
      const emojiIndices = spatialGridRef.current.get(cellKey) || []
      for (const index of emojiIndices) {
        const emoji = emojis[index]
        if (!emoji) continue

        // Calculate opacity for dark mode fading
        let opacity = 1
        if (isDarkMode) {
          const age = now - emoji.createdAt
          if (age > EMOJI_FADE_DURATION) {
            opacity = Math.max(0, 1 - (age - EMOJI_FADE_DURATION) / 2000) // 2 second fade out
          }
          if (opacity <= 0) continue // Skip fully faded emojis
        }

        const sizeKey = Math.round(emoji.size * 10)
        if (!sizeGroups.has(sizeKey)) {
          sizeGroups.set(sizeKey, [])
        }
        sizeGroups.get(sizeKey)!.push({ index, opacity })
      }
    }

    // Render by size group to minimize font changes
    for (const [sizeKey, items] of sizeGroups) {
      ctx.font = `${sizeKey / 10}em serif`
      for (const { index, opacity } of items) {
        const emoji = emojis[index]
        ctx.globalAlpha = opacity
        ctx.fillText(emoji.emoji, emoji.x, emoji.y)
      }
    }

    ctx.globalAlpha = 1 // Reset
  }, [theme])

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
    const newEmoji: EmojiItem = { id: nextId.current, emoji: currentEmoji, x, y, size, createdAt: Date.now() }

    // Direct mutation for performance - no re-render needed
    emojisRef.current.push(newEmoji)
    addToSpatialGrid(newEmoji, emojisRef.current.length - 1)
    nextId.current += 1
    needsRenderRef.current = true

    // Update count for UI display (debounced via batching)
    setEmojiCount(emojisRef.current.length)
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
      <h1
        className={cn(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-8deg] z-0 font-damion text-7xl md:text-8xl select-none pointer-events-none transition-all duration-500",
          theme === "dark" ? "text-gray-400/30" : "text-white"
        )}
        style={{
          WebkitTextStroke: theme === "dark" ? "1px rgba(100,100,120,0.3)" : "2px black",
          textShadow: theme === "dark" ? "none" : `
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000,
    2px 2px 0 #000,
    3px 3px 0 #000,
    4px 4px 0 #000,
    5px 5px 0 #000,
    6px 6px 0 #000
  `,
        }}
      >
        {theme === "dark" ? "Tears in Rain" : "Emoji Canvas"}
      </h1>

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
