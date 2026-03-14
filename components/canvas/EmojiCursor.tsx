"use client"

import { useState, useEffect } from "react"

interface EmojiCursorProps {
  emoji: string
}

export function EmojiCursor({ emoji }: EmojiCursorProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => {
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
