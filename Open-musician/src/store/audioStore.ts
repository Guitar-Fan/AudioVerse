import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AudioEngine, LoopRegion, TransportSnapshot } from '../audio/AudioEngine'

type AudioState = {
  engine: AudioEngine | null
  isReady: boolean
  transport: TransportSnapshot
  initEngine: () => Promise<void>
  teardown: () => void
  play: () => Promise<void>
  pause: () => void
  stop: () => void
  setBpm: (bpm: number) => void
  setTimeSignature: (signature: number | [number, number]) => void
  setLoop: (loop: LoopRegion) => void
  tapTempo: () => void
  locate: (seconds: number) => void
}

const defaultTransport: TransportSnapshot = {
  bpm: 120,
  timeSignature: 4,
  position: '0:0:0',
  seconds: 0,
  isPlaying: false,
  loop: {
    enabled: false,
    start: 0,
    end: 4,
  },
}

let unsubscribeTransport: (() => void) | null = null

export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => ({
      engine: null,
      isReady: false,
      transport: defaultTransport,
      initEngine: async () => {
        if (get().engine) return
        const engine = new AudioEngine()
        await engine.init()
        unsubscribeTransport = engine.subscribe((snapshot) => set({ transport: snapshot }))
        set({ engine, isReady: true })
      },
      teardown: () => {
        unsubscribeTransport?.()
        unsubscribeTransport = null
        get().engine?.dispose()
        set({ engine: null, isReady: false, transport: defaultTransport })
      },
      play: async () => {
        const engine = get().engine
        if (!engine) return
        await engine.play()
      },
      pause: () => {
        get().engine?.pause()
      },
      stop: () => {
        get().engine?.stop()
      },
      setBpm: (bpm) => {
        get().engine?.setBpm(bpm)
      },
      setTimeSignature: (signature) => {
        get().engine?.setTimeSignature(signature)
      },
      setLoop: (loop) => {
        get().engine?.setLoop(loop)
      },
      tapTempo: () => {
        get().engine?.tapTempo()
      },
      locate: (seconds) => {
        get().engine?.locate(seconds)
      },
    }),
    {
      name: 'audio-store',
      partialize: (state) => ({ isReady: state.isReady }),
    }
  )
)
