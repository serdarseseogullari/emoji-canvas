import { Shuffle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { colorCategories } from "@/lib/emoji-utils"
import { COLOR_MAP } from "@/constants/canvas"

interface ControlBarProps {
  isShuffleMode: boolean
  selectedColor: string | null
  onToggleShuffle: () => void
  onColorSelect: (color: string) => void
  onClear: () => void
}

export function ControlBar({
  isShuffleMode,
  selectedColor,
  onToggleShuffle,
  onColorSelect,
  onClear,
}: ControlBarProps) {
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-full shadow-lg p-2 flex items-center gap-2 z-10">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "rounded-full",
          isShuffleMode ? "bg-primary/20 text-primary" : "text-muted-foreground"
        )}
        onClick={onToggleShuffle}
        aria-label={isShuffleMode ? "Disable shuffle mode" : "Enable shuffle mode"}
      >
        <Shuffle className="h-5 w-5" />
      </Button>

      {!isShuffleMode && (
        <div className="flex items-center gap-1 px-2">
          {Object.entries(colorCategories).map(([color]) => (
            <button
              key={color}
              className={cn(
                "w-8 h-8 rounded-full transition-transform",
                selectedColor === color ? "scale-110 ring-2 ring-primary ring-offset-2" : ""
              )}
              style={{ backgroundColor: COLOR_MAP[color] }}
              onClick={() => onColorSelect(color)}
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
        onClick={onClear}
        aria-label="Clear canvas"
      >
        <Trash2 className="h-5 w-5" />
      </Button>
    </div>
  )
}
