import { useEffect } from 'react'
import { useAudioStore } from '../store/audioStore'

export function useAudioEngine() {
  const engine = useAudioStore((state) => state.engine)
  const initEngine = useAudioStore((state) => state.initEngine)

  useEffect(() => {
    if (!engine) {
      void initEngine()
    }
  }, [engine, initEngine])

  return engine
}
