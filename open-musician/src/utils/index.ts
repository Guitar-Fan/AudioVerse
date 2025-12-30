export function formatDb(value: number) {
  const clamped = Math.max(-60, Math.min(6, value))
  if (clamped <= -50) {
    return '-∞ dB'
  }
  return `${clamped.toFixed(1)} dB`
}

export function formatBars(bars: number) {
  return `${bars} bar${bars === 1 ? '' : 's'}`
}
