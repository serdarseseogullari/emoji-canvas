import { useEffect, useRef, useCallback } from "react"
import type { CanvasContext, RainParticle } from "@/types/canvas"
import { RAIN_CONFIG } from "@/constants/canvas"

export function useRainAnimation(
  isDark: boolean,
  rainCtxRef: React.RefObject<CanvasContext>,
  rainCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  rainParticlesRef: React.RefObject<RainParticle[]>,
  dprRef: React.RefObject<number>
) {
  const rainRafRef = useRef<number | null>(null)

  const renderRain = useCallback(() => {
    const ctx = rainCtxRef.current
    const canvas = rainCanvasRef.current
    if (!ctx || !canvas) return

    const dpr = dprRef.current
    const width = canvas.width / dpr
    const height = canvas.height / dpr

    ctx.clearRect(0, 0, width, height)

    // Fine rain streaks with slight angle
    ctx.lineWidth = RAIN_CONFIG.lineWidth
    for (const p of rainParticlesRef.current) {
      ctx.strokeStyle = p.color
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(
        p.x + p.length * p.vx * RAIN_CONFIG.lineMultiplier,
        p.y + p.length * p.vy * RAIN_CONFIG.lineMultiplier
      )
      ctx.stroke()

      p.x += p.vx
      p.y += p.vy
      if (p.y > height) {
        p.y = -p.length * RAIN_CONFIG.lineMultiplier
        p.x = Math.random() * width
      }
    }
  }, [rainCtxRef, rainCanvasRef, rainParticlesRef, dprRef])

  useEffect(() => {
    if (!isDark) {
      if (rainRafRef.current) cancelAnimationFrame(rainRafRef.current)
      return
    }

    const animateRain = () => {
      renderRain()
      rainRafRef.current = requestAnimationFrame(animateRain)
    }

    rainRafRef.current = requestAnimationFrame(animateRain)
    return () => {
      if (rainRafRef.current) cancelAnimationFrame(rainRafRef.current)
    }
  }, [isDark, renderRain])
}
