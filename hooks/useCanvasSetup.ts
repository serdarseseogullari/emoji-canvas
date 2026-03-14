import { useEffect, useRef, useCallback } from "react"
import type { CanvasContext, RainParticle } from "@/types/canvas"
import { RAIN_PARTICLE_COUNT, RAIN_CONFIG } from "@/constants/canvas"
import { SpatialGrid } from "@/utils/SpatialGrid"

interface UseCanvasSetupReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  rainCanvasRef: React.RefObject<HTMLCanvasElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  ctxRef: React.RefObject<CanvasContext>
  rainCtxRef: React.RefObject<CanvasContext>
  dprRef: React.RefObject<number>
  rainParticlesRef: React.RefObject<RainParticle[]>
  visibleCellsRef: React.RefObject<Set<string>>
  needsRenderRef: React.RefObject<boolean>
}

export function useCanvasSetup(
  spatialGrid: SpatialGrid
): UseCanvasSetupReturn {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rainCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const ctxRef = useRef<CanvasContext>(null)
  const rainCtxRef = useRef<CanvasContext>(null)
  const dprRef = useRef(1)
  const rainParticlesRef = useRef<RainParticle[]>([])
  const visibleCellsRef = useRef<Set<string>>(new Set())
  const needsRenderRef = useRef(true)

  const initRainDrops = useCallback((width: number, height: number) => {
    const particles: RainParticle[] = []
    for (let i = 0; i < RAIN_PARTICLE_COUNT; i++) {
      const length = Math.random() * 0.9 + 0.1
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * RAIN_CONFIG.horizontalDrift,
        vy: Math.random() * (RAIN_CONFIG.maxSpeed - RAIN_CONFIG.minSpeed) + RAIN_CONFIG.minSpeed,
        length,
        color: `rgba(${RAIN_CONFIG.color.r}, ${RAIN_CONFIG.color.g}, ${RAIN_CONFIG.color.b}, ${
          Math.random() * (RAIN_CONFIG.maxOpacity - RAIN_CONFIG.minOpacity) + RAIN_CONFIG.minOpacity
        })`,
      })
    }
    rainParticlesRef.current = particles
  }, [])

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
        visibleCellsRef.current = spatialGrid.getVisibleCells(width, height)
        needsRenderRef.current = true
      }
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    return () => {
      window.removeEventListener("resize", resizeCanvas)
    }
  }, [initRainDrops, spatialGrid])

  return {
    canvasRef,
    rainCanvasRef,
    containerRef,
    ctxRef,
    rainCtxRef,
    dprRef,
    rainParticlesRef,
    visibleCellsRef,
    needsRenderRef,
  }
}
