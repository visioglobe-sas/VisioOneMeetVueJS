// App palette, shared by every color picker, plus the one color helper.
export const PALETTE = {
  blue: '#0094F0',
  red: '#E53935',
  green: '#43A047',
  purple: '#8E24AA',
  yellow: '#FFEB3B',
  white: '#FFFFFF',
  dark: '#212121',
  highlight: '#057DBC',
  // Availability colors (occupancy, clickable surface, geofence alert).
  free: '#2ECC71',
  soonBusy: '#F1C40F',
  busy: '#E74C3C',
}

// Parses '#RGB' or '#RRGGBB' into { r, g, b } (0-255), or null.
export function parseHexColor(hex) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex ?? '')
  if (!match) return null
  const digits = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1]
  const value = parseInt(digits, 16)
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

// Relative luminance (0 = black, 1 = white), used to give very dark or very
// light chips an outline so they stay visible on the dark panel.
export function colorLuminance(hex) {
  const rgb = parseHexColor(hex)
  if (!rgb) return 0.5
  const channel = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
}
