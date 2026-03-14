"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { getRandomEmoji, colorCategories } from "@/lib/emoji-utils"
import { SpatialGrid } from "@/utils/SpatialGrid"
import { useCanvasSetup } from "@/hooks/useCanvasSetup"
import { useEmojiDrawing } from "@/hooks/useEmojiDrawing"
import { useRainAnimation } from "@/hooks/useRainAnimation"
import { CanvasTitle } from "@/components/canvas/CanvasTitle"
import { ControlBar } from "@/components/canvas/ControlBar"
import { ThemeToggle } from "@/components/canvas/ThemeToggle"
import { EmojiCounter } from "@/components/canvas/EmojiCounter"
import { EmojiCursor } from "@/components/canvas/EmojiCursor"

export default function EmojiCanvas() {
  const [currentEmoji, setCurrentEmoji] = useState<string>("😀")
  const [isShuffleMode, setIsShuffleMode] = useState<boolean>(true)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState<boolean>(false)
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const isDark = resolvedTheme === "dark"

  // Create spatial grid instance
  const spatialGrid = useMemo(() => new SpatialGrid(), [])

  // Setup canvas and refs
  const {
    canvasRef,
    rainCanvasRef,
    containerRef,
    ctxRef,
    rainCtxRef,
    dprRef,
    rainParticlesRef,
    visibleCellsRef,
    needsRenderRef,
  } = useCanvasSetup(spatialGrid)

  // Emoji drawing logic
  const { emojiCount, placeEmoji, clearCanvas, lastPosition } = useEmojiDrawing({
    currentEmoji,
    spatialGrid,
    ctxRef,
    canvasRef,
    dprRef,
    visibleCellsRef,
    needsRenderRef,
  })

  // Rain animation
  useRainAnimation(isDark, rainCtxRef, rainCanvasRef, rainParticlesRef, dprRef)

  // Prevent hydration mismatch for theme toggle button
  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent scrolling on mobile
  useEffect(() => {
    const preventDefault = (e: TouchEvent) => {
      if (containerRef.current?.contains(e.target as Node)) {
        e.preventDefault()
      }
    }

    document.addEventListener("touchmove", preventDefault, { passive: false })
    return () => document.removeEventListener("touchmove", preventDefault)
  }, [containerRef])

  // Event handlers
  const handlePlaceEmoji = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      placeEmoji(clientX, clientY, rect)
    },
    [containerRef, placeEmoji]
  )

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDrawing(true)
    lastPosition.current = null
    handlePlaceEmoji(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing) return
    handlePlaceEmoji(e.clientX, e.clientY)
  }

  const handleDrawEnd = useCallback(() => {
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
      handlePlaceEmoji(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDrawing) return
    if (e.touches.length > 0) {
      handlePlaceEmoji(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

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
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-50 dark:bg-gray-900">
      <CanvasTitle isDark={isDark} />

      {/* Custom cursor styles */}
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

        html, body {
          overscroll-behavior: none;
          overflow: hidden;
          position: fixed;
          width: 100%;
          height: 100%;
        }
        
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
        onMouseUp={handleDrawEnd}
        onMouseLeave={handleDrawEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleDrawEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
        <canvas
          ref={rainCanvasRef}
          className={cn(
            "absolute top-0 left-0 w-full h-full pointer-events-none transition-opacity duration-500",
            isDark ? "opacity-100" : "opacity-0"
          )}
        />
      </div>

      <EmojiCursor emoji={currentEmoji} />

      <ControlBar
        isShuffleMode={isShuffleMode}
        selectedColor={selectedColor}
        onToggleShuffle={toggleShuffleMode}
        onColorSelect={handleColorSelect}
        onClear={clearCanvas}
      />

      <ThemeToggle isDark={isDark} onToggle={toggleTheme} mounted={mounted} />

      <EmojiCounter count={emojiCount} isDark={isDark} />
    </div>
  )
}
