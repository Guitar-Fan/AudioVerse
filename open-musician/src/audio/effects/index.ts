export type EffectSlot = {
  id: string
  name: string
  type: 'reverb' | 'delay' | 'compressor'
  bypassed: boolean
}

export const defaultEffects: EffectSlot[] = [
  { id: 'fx-1', name: 'Room Reverb', type: 'reverb', bypassed: false },
  { id: 'fx-2', name: 'Tape Echo', type: 'delay', bypassed: true },
  { id: 'fx-3', name: 'Bus Glue', type: 'compressor', bypassed: false },
]
