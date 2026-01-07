import * as Tone from 'tone'

export type LoopRegion = {
  enabled: boolean
  start: number
  end: number
}

export type TransportSnapshot = {
  bpm: number
  timeSignature: number | [number, number]
  position: string
  seconds: number
  isPlaying: boolean
  loop: LoopRegion
}

export type TransportSubscriber = (snapshot: TransportSnapshot) => void

const DEFAULT_LOOP: LoopRegion = {
  enabled: false,
  start: 0,
  end: 4,
}

export class AudioEngine {
  private transport = Tone.Transport
  private masterBus: Tone.Volume
  private trackBuses = new Map<string, Tone.Channel>()
  private metronome: Tone.MembraneSynth
  private metronomePatternId?: number
  private tapTimes: number[] = []
  private subscribers = new Set<TransportSubscriber>()

  constructor() {
    this.masterBus = new Tone.Volume(0).toDestination()
    this.metronome = new Tone.MembraneSynth({
      volume: -6,
      envelope: { decay: 0.08, sustain: 0.1 },
    }).connect(this.masterBus)
    this.configureTransport()
  }

  private configureTransport() {
    this.transport.bpm.value = 120
    this.transport.loopStart = 0
    this.transport.loopEnd = 4
    this.transport.loop = false

    if (this.metronomePatternId !== undefined) {
      this.transport.clear(this.metronomePatternId)
    }

    let step = 0
    this.metronomePatternId = this.transport.scheduleRepeat((time) => {
      const isDownBeat = step % 16 === 0
      const pitch = isDownBeat ? 'C6' : 'G5'
      this.metronome.triggerAttackRelease(pitch, '16n', time)
      this.notifySubscribers()
      step += 1
    }, '16n')
  }

  async init() {
    await Tone.start()
  }

  dispose() {
    this.metronome.dispose()
    this.masterBus.dispose()
    this.trackBuses.forEach((bus) => bus.dispose())
    if (this.metronomePatternId !== undefined) {
      this.transport.clear(this.metronomePatternId)
    }
    this.subscribers.clear()
  }

  getMasterBus() {
    return this.masterBus
  }

  createTrackBus(trackId: string) {
    if (this.trackBuses.has(trackId)) {
      return this.trackBuses.get(trackId)!
    }
    const channel = new Tone.Channel({ volume: 0, pan: 0 })
    channel.connect(this.masterBus)
    this.trackBuses.set(trackId, channel)
    return channel
  }

  removeTrackBus(trackId: string) {
    const bus = this.trackBuses.get(trackId)
    if (!bus) return
    bus.dispose()
    this.trackBuses.delete(trackId)
  }

  async play(position?: number) {
    await Tone.start()
    if (typeof position === 'number') {
      this.transport.seconds = position
    }
    this.transport.start()
    this.notifySubscribers()
  }

  pause() {
    this.transport.pause()
    this.notifySubscribers()
  }

  stop() {
    this.transport.stop()
    this.transport.position = '0:0:0'
    this.notifySubscribers()
  }

  locate(seconds: number) {
    this.transport.seconds = seconds
    this.notifySubscribers()
  }

  setBpm(bpm: number, rampTime = 0.15) {
    this.transport.bpm.rampTo(bpm, rampTime)
    this.notifySubscribers()
  }

  setTimeSignature(signature: number | [number, number]) {
    this.transport.timeSignature = signature
    this.notifySubscribers()
  }

  setLoop(loop: LoopRegion) {
    this.transport.loop = loop.enabled
    this.transport.loopStart = loop.start
    this.transport.loopEnd = loop.end
    this.notifySubscribers()
  }

  toggleMetronome(enabled: boolean) {
    this.metronome.volume.rampTo(enabled ? -6 : -Infinity, 0.05)
  }

  tapTempo() {
    const now = performance.now()
    this.tapTimes.push(now)
    this.tapTimes = this.tapTimes.slice(-4)
    if (this.tapTimes.length < 2) return
    const intervals = this.tapTimes.slice(1).map((time, index) => time - this.tapTimes[index])
    const avgMs = intervals.reduce((sum, val) => sum + val, 0) / intervals.length
    const bpm = Math.min(240, Math.max(40, 60000 / avgMs))
    this.setBpm(bpm)
  }

  subscribe(listener: TransportSubscriber) {
    this.subscribers.add(listener)
    listener(this.getSnapshot())
    return () => this.subscribers.delete(listener)
  }

  private notifySubscribers() {
    const snapshot = this.getSnapshot()
    this.subscribers.forEach((listener) => listener(snapshot))
  }

  private getSnapshot(): TransportSnapshot {
    return {
      bpm: this.transport.bpm.value,
      timeSignature: this.transport.timeSignature,
      position: this.transport.position,
      seconds: this.transport.seconds,
      isPlaying: this.transport.state === 'started',
      loop: {
        enabled: this.transport.loop,
        start: this.transport.loopStart,
        end: this.transport.loopEnd,
      },
    }
  }

  getLoopRegion(): LoopRegion {
    return {
      enabled: this.transport.loop,
      start: this.transport.loopStart,
      end: this.transport.loopEnd,
    }
  }

  getDefaultLoop() {
    return { ...DEFAULT_LOOP }
  }
}
