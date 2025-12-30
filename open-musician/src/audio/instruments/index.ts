export type InstrumentPreset = {
  id: string
  name: string
  engine: 'wavetable' | 'fm' | 'analog'
}

export const defaultInstruments: InstrumentPreset[] = [
  { id: 'inst-1', name: 'Glass Keys', engine: 'wavetable' },
  { id: 'inst-2', name: 'FM Bells', engine: 'fm' },
  { id: 'inst-3', name: 'Poly Synth', engine: 'analog' },
]
