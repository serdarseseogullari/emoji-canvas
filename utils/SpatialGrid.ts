import type { EmojiItem } from "@/types/canvas"
import { GRID_CELL_SIZE } from "@/constants/canvas"

export class SpatialGrid {
  private grid: Map<string, number[]> = new Map()
  private cellSize: number

  constructor(cellSize: number = GRID_CELL_SIZE) {
    this.cellSize = cellSize
  }

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize)
    const cellY = Math.floor(y / this.cellSize)
    return `${cellX},${cellY}`
  }

  add(emoji: EmojiItem, index: number): void {
    const cellKey = this.getCellKey(emoji.x, emoji.y)
    if (!this.grid.has(cellKey)) {
      this.grid.set(cellKey, [])
    }
    this.grid.get(cellKey)!.push(index)
  }

  rebuild(emojis: EmojiItem[]): void {
    this.grid.clear()
    emojis.forEach((emoji, i) => this.add(emoji, i))
  }

  getIndicesForCell(cellKey: string): number[] {
    return this.grid.get(cellKey) || []
  }

  getVisibleCells(width: number, height: number): Set<string> {
    const startCellX = Math.floor(0 / this.cellSize) - 1
    const startCellY = Math.floor(0 / this.cellSize) - 1
    const endCellX = Math.ceil(width / this.cellSize) + 1
    const endCellY = Math.ceil(height / this.cellSize) + 1

    const visibleCells = new Set<string>()

    for (let y = startCellY; y <= endCellY; y++) {
      for (let x = startCellX; x <= endCellX; x++) {
        visibleCells.add(`${x},${y}`)
      }
    }

    return visibleCells
  }

  clear(): void {
    this.grid.clear()
  }
}
