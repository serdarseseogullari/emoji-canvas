interface CanvasTitleProps {
  isDark: boolean
}

export function CanvasTitle({ isDark }: CanvasTitleProps) {
  return (
    <svg
      className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-8deg] z-0 select-none pointer-events-none overflow-visible transition-all duration-500"
      style={{ width: "min(90vw, 640px)", height: "auto" }}
      viewBox="0 0 600 120"
      xmlns="http://www.w3.org/2000/svg"
    >
      {!isDark && (
        <>
          {/* Depth shadow layers rendered first (back) */}
          {[6, 5, 4, 3, 2].map((i) => (
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
        fill={isDark ? "rgba(100,100,120,0.15)" : "white"}
        stroke={isDark ? "rgba(100,100,120,0.25)" : "black"}
        strokeWidth={isDark ? "1" : "5"}
        strokeLinejoin="round"
        style={{ paintOrder: "stroke fill" }}
      >
        Emoji Canvas
      </text>
    </svg>
  )
}
