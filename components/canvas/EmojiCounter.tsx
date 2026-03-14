interface EmojiCounterProps {
  count: number
  isDark: boolean
}

export function EmojiCounter({ count, isDark }: EmojiCounterProps) {
  if (count === 0) return null

  return (
    <div className="fixed top-4 left-4 z-10 bg-white dark:bg-gray-800 rounded-full shadow-lg px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-300">
      {count.toLocaleString()} {isDark ? "tears in rain" : "emojis"}
    </div>
  )
}
