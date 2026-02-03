// Define emoji categories by color
export const colorCategories: Record<string, string[]> = {
  red: ["❤️", "🔴", "🍎", "🍓", "🍒", "🌹", "🧧", "🚨", "📕", "🧯", "🥊", "🧠", "👹", "🍄", "🦞", "🦀", "🦐", "🍅"],
  orange: ["🧡", "🟠", "🍊", "🥕", "🦊", "🦁", "🐯", "🍑", "🥭", "🧶", "🦒", "🔶", "🚧", "🔸", "🏀", "🎃"],
  yellow: ["💛", "🟡", "🍋", "🍌", "🌻", "⭐", "🌟", "✨", "🌞", "🐤", "🐥", "🍯", "🧀", "🌽", "🍍", "🚕", "🚖"],
  green: ["💚", "🟢", "🍏", "🥝", "🥑", "🥬", "🥦", "🌿", "☘️", "🍀", "🌱", "🌲", "🌳", "🌴", "🐸", "🐢", "🦎", "🐊"],
  blue: ["💙", "🔵", "🫐", "🌊", "🌈", "🐬", "🐋", "🐟", "🦕", "🧢", "👖", "🚾", "🧊", "🥶", "❄️", "☃️", "🌨️"],
  purple: ["💜", "🟣", "🍇", "🍆", "🔮", "☂️", "☔", "🦄", "🦹", "👾", "👿", "👽", "🧕", "🧞", "🧚"],
  pink: ["🩷", "💗", "💕", "💖", "💓", "💘", "💝", "🎀", "🌸", "🌷", "🌺", "🧠", "🦩", "🍥", "🧁", "🍬", "🍭"],
  brown: ["🤎", "🟤", "🍫", "🍪", "🥜", "🌰", "🦮", "🐕", "🦦", "🦫", "🦥", "🐿️", "🦔", "🐪", "🐫", "🦙", "🦬"],
}

// Get a random emoji, optionally filtered by color
export function getRandomEmoji(color?: string): string {
  if (color && colorCategories[color]) {
    const colorEmojis = colorCategories[color]
    return colorEmojis[Math.floor(Math.random() * colorEmojis.length)]
  }

  // If no color specified or invalid color, return a random emoji from all categories
  const allEmojis = Object.values(colorCategories).flat()
  return allEmojis[Math.floor(Math.random() * allEmojis.length)]
}
