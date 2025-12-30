export type TrackCategory = 'audio' | 'midi' | 'instrument' | 'return' | 'master'

export interface TrackSend {
  id: string
  name: string
  level: number // 0-1 linear gain
}

export interface Track {
  id: string
  name: string
  type: TrackCategory
  color: string
  volume: number
  pan: number
  muted: boolean
  solo: boolean
  armed: boolean
  instrumentId?: string
  effects: string[]
  outputId?: string
  sends: TrackSend[]
}

export const defaultTracks: Track[] = [
  {
    id: 'trk-1',
    name: 'Drums',
    type: 'audio',
    color: '#FF7A18',
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    effects: ['eq3', 'compressor'],
    outputId: 'master',
    sends: [{ id: 'snd-verb', name: 'Verb', level: 0.35 }],
  },
  {
    id: 'trk-2',
    name: 'Bass',
    type: 'instrument',
    color: '#2BD9FE',
    volume: 0.75,
    pan: -10,
    muted: false,
    solo: false,
    armed: false,
    instrumentId: 'fm-bass',
    effects: ['saturator'],
    outputId: 'master',
    sends: [{ id: 'snd-delay', name: 'Delay', level: 0.15 }],
  },
  {
    id: 'trk-3',
    name: 'Lead',
    type: 'midi',
    color: '#C74BFF',
    volume: 0.7,
    pan: 5,
    muted: false,
    solo: false,
    armed: true,
    instrumentId: 'poly-lead',
    effects: ['chorus', 'reverb'],
    outputId: 'master',
    sends: [],
  },
  {
    id: 'trk-4',
    name: 'FX Verb',
    type: 'return',
    color: '#5B8CFF',
    volume: 0.6,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    effects: ['lexikan'],
    outputId: 'master',
    sends: [],
  },
  {
    id: 'master',
    name: 'Master',
    type: 'master',
    color: '#FFFFFF',
    volume: 0.9,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    effects: ['meter', 'limiter'],
    outputId: undefined,
    sends: [],
  },
]
