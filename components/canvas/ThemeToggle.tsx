import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ThemeToggleProps {
  isDark: boolean
  onToggle: () => void
  mounted: boolean
}

export function ThemeToggle({ isDark, onToggle, mounted }: ThemeToggleProps) {
  if (!mounted) return null

  return (
    <Button
      variant="outline"
      size="icon"
      className="fixed top-4 right-4 z-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border-2 cursor-pointer transition-all duration-300 hover:scale-110 hover:shadow-xl dark:hover:shadow-[0_0_20px_rgba(250,204,21,0.4)] hover:shadow-gray-400/50"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-yellow-500" />
      ) : (
        <Moon className="h-5 w-5 text-gray-700" />
      )}
    </Button>
  )
}
