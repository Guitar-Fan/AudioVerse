import { create } from 'zustand'
import { defaultTracks } from '../audio/Track'
import type { Track } from '../audio/Track'

export type ClipType = 'audio' | 'midi'
export type ClipStatus = 'looping' | 'one-shot' | 'muted'

export interface Clip {
  id: string
  trackId: string
  type: ClipType
  name: string
  color: string
  start: number // in measures
  length: number // in measures
  loop: boolean
  status: ClipStatus
  velocity?: number
  stepData?: number[][]
  notes?: Array<{ pitch: string; time: number; duration: number }>
  audioFile?: string
}

export interface TimelineMarker {
  id: string
  position: number // measure index
  label: string
}

export type SequencerViewMode = 'arrange' | 'step' | 'score'

type ClipPayload = Omit<Clip, 'id'> & { id?: string }

const generateId = (prefix: string) => {
  const globalCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (globalCrypto?.randomUUID) {
    return `${prefix}-${globalCrypto.randomUUID()}`
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

const initialClips: Clip[] = [
  {
    id: 'clip-1',
    trackId: 'trk-1',
    type: 'audio',
    name: 'Drum Loop',
    color: '#FF7A18',
    start: 0,
    length: 4,
    loop: true,
    status: 'looping',
    audioFile: 'drum-loop-01.wav',
  },
  {
    id: 'clip-2',
    trackId: 'trk-2',
    type: 'midi',
    name: 'Bassline',
    color: '#2BD9FE',
    start: 4,
    length: 4,
    loop: true,
    status: 'looping',
    stepData: [
      [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
      [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    ],
  },
  {
    id: 'clip-3',
    trackId: 'trk-3',
    type: 'midi',
    name: 'Lead Hook',
    color: '#C74BFF',
    start: 2,
    length: 6,
    loop: false,
    status: 'one-shot',
    notes: [
      { pitch: 'A4', time: 0, duration: 0.5 },
      { pitch: 'C5', time: 0.5, duration: 0.5 },
      { pitch: 'E5', time: 1, duration: 1 },
    ],
  },
]

const initialMarkers: TimelineMarker[] = [
  { id: 'marker-1', position: 0, label: 'Intro' },
  { id: 'marker-2', position: 4, label: 'Verse' },
  { id: 'marker-3', position: 8, label: 'Chorus' },
]

type ProjectState = {
  tracks: Track[]
  clips: Clip[]
  markers: TimelineMarker[]
  selectedTrackId?: string
  zoom: number
  viewMode: SequencerViewMode
  setTracks: (tracks: Track[]) => void
  selectTrack: (trackId: string) => void
  setZoom: (zoom: number) => void
  setViewMode: (mode: SequencerViewMode) => void
  addClip: (clip: ClipPayload) => void
  duplicateClip: (clipId: string, offsetMeasures?: number) => void
  splitClip: (clipId: string, splitMeasure: number) => void
  mergeClips: (clipIds: string[]) => void
  updateClip: (clipId: string, payload: Partial<Clip>) => void
  addMarker: (marker: TimelineMarker) => void
  updateMarker: (id: string, payload: Partial<TimelineMarker>) => void
  removeMarker: (markerId: string) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  tracks: defaultTracks,
  clips: initialClips,
  markers: initialMarkers,
  selectedTrackId: defaultTracks[0]?.id,
  zoom: 1,
  viewMode: 'arrange',
  setTracks: (tracks) => set({ tracks }),
  selectTrack: (trackId) => set({ selectedTrackId: trackId }),
  setZoom: (zoom) =>
    set({
      zoom: Math.min(4, Math.max(0.5, Number.isFinite(zoom) ? zoom : 1)),
    }),
  setViewMode: (mode) => set({ viewMode: mode }),
  addClip: (clipInput) =>
    set((state) => ({
      clips: [...state.clips, { ...clipInput, id: clipInput.id ?? generateId('clip') }],
    })),
  duplicateClip: (clipId, offsetMeasures = 0) =>
    set((state) => {
      const clip = state.clips.find((c) => c.id === clipId)
      if (!clip) return state
      const newClip: Clip = {
        ...clip,
        id: generateId('clip'),
        start: clip.start + clip.length + offsetMeasures,
        name: `${clip.name} Copy`,
      }
      return { clips: [...state.clips, newClip] }
    }),
  splitClip: (clipId, splitMeasure) =>
    set((state) => {
      const clip = state.clips.find((c) => c.id === clipId)
      if (!clip) return state
      if (splitMeasure <= clip.start || splitMeasure >= clip.start + clip.length) {
        return state
      }
      const firstLength = splitMeasure - clip.start
      const secondLength = clip.length - firstLength
      const newClip: Clip = {
        ...clip,
        id: generateId('clip'),
        start: splitMeasure,
        length: secondLength,
        name: `${clip.name} Tail`,
      }
      return {
        clips: state.clips.flatMap((c) =>
          c.id === clipId ? [{ ...c, length: firstLength }, newClip] : [c],
        ),
      }
    }),
  mergeClips: (clipIds) =>
    set((state) => {
      if (clipIds.length < 2) return state
      const clipsToMerge = state.clips.filter((clip) => clipIds.includes(clip.id))
      if (clipsToMerge.length < 2) return state
      const [firstTrack] = clipsToMerge
      if (!clipsToMerge.every((clip) => clip.trackId === firstTrack.trackId)) {
        return state
      }
      const sorted = [...clipsToMerge].sort((a, b) => a.start - b.start)
      const mergedClip: Clip = {
        ...sorted[0],
        id: generateId('clip'),
        start: sorted[0].start,
        length: sorted[sorted.length - 1].start + sorted[sorted.length - 1].length - sorted[0].start,
        name: `${sorted[0].name.split(' ')[0]} Merge`,
      }
      const remaining = state.clips.filter((clip) => !clipIds.includes(clip.id))
      return { clips: [...remaining, mergedClip] }
    }),
  updateClip: (clipId, payload) =>
    set((state) => ({
      clips: state.clips.map((clip) => (clip.id === clipId ? { ...clip, ...payload } : clip)),
    })),
  addMarker: (marker) =>
    set((state) => ({
      markers: [...state.markers, marker],
    })),
  updateMarker: (id, payload) =>
    set((state) => ({
      markers: state.markers.map((marker) => (marker.id === id ? { ...marker, ...payload } : marker)),
    })),
  removeMarker: (markerId) =>
    set((state) => ({
      markers: state.markers.filter((marker) => marker.id !== markerId),
    })),
}))
