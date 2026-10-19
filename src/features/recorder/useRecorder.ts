import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isRecordingSupported,
  levelFromSamples,
  mapRecorderError,
  pickMimeType,
  type RecorderError,
} from './recorderSupport'
import type { Recording } from './types'

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'done' | 'error'

export interface RecorderState {
  status: RecorderStatus
  error: RecorderError | null
  elapsedMs: number
  /** 현재 입력 크기 0..1. 녹음 중에만 갱신된다. */
  level: number
  recording: Recording | null
}

interface Options {
  /** 이 길이에 닿으면 자동으로 끝낸다. */
  maxMs: number
}

const INITIAL: RecorderState = { status: 'idle', error: null, elapsedMs: 0, level: 0, recording: null }
const LEVEL_INTERVAL_MS = 50

/**
 * 마이크 녹음 훅.
 * 오디오는 메모리의 Blob으로만 존재하며 이 훅은 네트워크를 쓰지 않는다.
 * 언마운트되면 녹음을 멈추고 마이크와 AudioContext를 해제한다.
 */
export function useRecorder({ maxMs }: Options) {
  const [state, setState] = useState<RecorderState>(INITIAL)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const rafRef = useRef(0)
  const startedAtRef = useRef(0)
  const lastLevelAtRef = useRef(0)

  const releaseHardware = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    for (const track of streamRef.current?.getTracks() ?? []) track.stop()
    streamRef.current = null
    analyserRef.current = null
    const context = contextRef.current
    contextRef.current = null
    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined)
    }
  }, [])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    // Recording 생성과 자원 해제는 onstop에서 한다.
  }, [])

  const start = useCallback(async () => {
    if (recorderRef.current) return
    if (!isRecordingSupported()) {
      setState({ ...INITIAL, status: 'error', error: 'unsupported' })
      return
    }

    setState({ ...INITIAL, status: 'requesting' })

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (error) {
      setState({ ...INITIAL, status: 'error', error: mapRecorderError(error) })
      return
    }
    streamRef.current = stream

    const mimeType = pickMimeType((type) => MediaRecorder.isTypeSupported(type))
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch (error) {
      releaseHardware()
      setState({ ...INITIAL, status: 'error', error: mapRecorderError(error) })
      return
    }
    recorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      const durationMs = Math.round(performance.now() - startedAtRef.current)
      const type = recorder.mimeType || mimeType || 'audio/webm'
      const blob = new Blob(chunksRef.current, { type })
      chunksRef.current = []
      recorderRef.current = null
      releaseHardware()
      setState({ status: 'done', error: null, elapsedMs: durationMs, level: 0, recording: { blob, mimeType: type, durationMs } })
    }
    recorder.onerror = () => {
      recorderRef.current = null
      releaseHardware()
      setState({ ...INITIAL, status: 'error', error: 'unknown' })
    }

    // 레벨 미터. 실패해도 녹음은 계속한다.
    try {
      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      contextRef.current = context
      analyserRef.current = analyser
    } catch {
      analyserRef.current = null
    }

    recorder.start(250)
    startedAtRef.current = performance.now()
    lastLevelAtRef.current = 0
    setState({ status: 'recording', error: null, elapsedMs: 0, level: 0, recording: null })

    const samples = new Float32Array(analyserRef.current?.fftSize ?? 0)
    const tick = (now: number) => {
      const elapsed = now - startedAtRef.current
      if (elapsed >= maxMs) {
        stop()
        return
      }
      if (now - lastLevelAtRef.current >= LEVEL_INTERVAL_MS) {
        lastLevelAtRef.current = now
        let level = 0
        if (analyserRef.current) {
          analyserRef.current.getFloatTimeDomainData(samples)
          level = levelFromSamples(samples)
        }
        setState((prev) =>
          prev.status === 'recording' ? { ...prev, elapsedMs: Math.round(elapsed), level } : prev,
        )
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [maxMs, releaseHardware, stop])

  const reset = useCallback(() => {
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.ondataavailable = null
      recorder.stop()
    }
    chunksRef.current = []
    releaseHardware()
    setState(INITIAL)
  }, [releaseHardware])

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current
      recorderRef.current = null
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null
        recorder.ondataavailable = null
        recorder.stop()
      }
      releaseHardware()
    }
  }, [releaseHardware])

  return { ...state, start, stop, reset }
}
