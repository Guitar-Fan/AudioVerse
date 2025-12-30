export type MidiClip = {
  id: string
  trackId: string
  lengthBars: number
  notes: Array<{ time: number; note: number; duration: number; velocity: number }>
}

export const demoClip: MidiClip = {
  id: 'clip-1',
  trackId: 'trk-3',
  lengthBars: 4,
  notes: [
    { time: 0, note: 60, duration: 0.5, velocity: 0.9 },
    { time: 1, note: 64, duration: 0.5, velocity: 0.8 },
    { time: 2, note: 67, duration: 0.5, velocity: 0.85 },
  ],
}
