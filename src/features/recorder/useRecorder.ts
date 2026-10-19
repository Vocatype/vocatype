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
  /** 미리 듣기용 blob: URL. 훅이 만들고 reset·언마운트 때 해제한다. */
  previewUrl: string | null
}

interface Options {
  /** 이 길이에 닿으면 자동으로 끝낸다. */
  maxMs: number
}

const INITIAL: RecorderState = { status: 'idle', error: null, elapsedMs: 0, level: 0, recording: null, previewUrl: null }
const LEVEL_INTERVAL_MS = 50

function detach(recorder: MediaRecorder) {
  recorder.onstop = null
  recorder.ondataavailable = null
  recorder.onerror = null
}

function safeStop(recorder: MediaRecorder) {
  if (recorder.state === 'inactive') return
  try {
    recorder.stop()
  } catch {
    // 이미 멈춘 경우 등. 무시한다.
  }
}

/**
 * 마이크 녹음 훅.
 * 오디오는 메모리의 Blob으로만 존재하며 이 훅은 네트워크를 쓰지 않는다.
 * 언마운트·reset 시 녹음을 멈추고 마이크와 AudioContext를 해제한다. 권한 프롬프트 중에 떠나도
 * 세대(generation) 토큰으로 뒤늦게 열린 스트림을 즉시 닫는다.
 */
export function useRecorder({ maxMs }: Options) {
  const [state, setState] = useState<RecorderState>(INITIAL)

  const generationRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const rafRef = useRef(0)
  const timeoutRef = useRef(0)
  const startedAtRef = useRef(0)
  const lastLevelAtRef = useRef(0)
  const previewUrlRef = useRef<string | null>(null)

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }, [])

  const releaseHardware = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = 0
    for (const track of streamRef.current?.getTracks() ?? []) track.stop()
    streamRef.current = null
    analyserRef.current = null
    const context = contextRef.current
    contextRef.current = null
    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined)
    }
  }, [])

  /** reset과 언마운트가 함께 쓰는 정리. 진행 중인 start()도 세대 토큰으로 무효화한다. */
  const dispose = useCallback(() => {
    generationRef.current += 1
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder) {
      detach(recorder)
      safeStop(recorder)
    }
    chunksRef.current = []
    releaseHardware()
    revokePreview()
  }, [releaseHardware, revokePreview])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder) safeStop(recorder)
    // Recording 생성과 자원 해제는 onstop에서 한다.
  }, [])

  const start = useCallback(async () => {
    if (recorderRef.current) return
    if (!isRecordingSupported()) {
      setState({ ...INITIAL, status: 'error', error: 'unsupported' })
      return
    }

    const generation = ++generationRef.current
    setState({ ...INITIAL, status: 'requesting' })

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (error) {
      if (generation === generationRef.current) setState({ ...INITIAL, status: 'error', error: mapRecorderError(error) })
      return
    }
    if (generation !== generationRef.current) {
      // 권한 프롬프트 중에 화면을 떠났거나 reset됐다. 열린 마이크를 바로 닫는다.
      for (const track of stream.getTracks()) track.stop()
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
      detach(recorder)
      const durationMs = Math.round(performance.now() - startedAtRef.current)
      const type = recorder.mimeType || mimeType || 'audio/webm'
      const blob = new Blob(chunksRef.current, { type })
      chunksRef.current = []
      recorderRef.current = null
      releaseHardware()
      revokePreview()
      const previewUrl = URL.createObjectURL(blob)
      previewUrlRef.current = previewUrl
      setState({ status: 'done', error: null, elapsedMs: durationMs, level: 0, recording: { blob, mimeType: type, durationMs }, previewUrl })
    }
    recorder.onerror = () => {
      // 오류 뒤에는 dataavailable → stop 이 이어지므로 핸들러를 먼저 떼어 done으로 덮어쓰이지 않게 한다.
      detach(recorder)
      safeStop(recorder)
      chunksRef.current = []
      recorderRef.current = null
      releaseHardware()
      setState({ ...INITIAL, status: 'error', error: 'unknown' })
    }

    // 레벨 미터. 실패해도 녹음은 계속한다. Safari는 제스처 밖에서 만든 컨텍스트가 suspended로 시작할 수 있다.
    try {
      const context = new AudioContext()
      if (context.state === 'suspended') void context.resume().catch(() => undefined)
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      contextRef.current = context
      analyserRef.current = analyser
    } catch {
      analyserRef.current = null
    }

    try {
      recorder.start(250)
    } catch (error) {
      detach(recorder)
      recorderRef.current = null
      releaseHardware()
      setState({ ...INITIAL, status: 'error', error: mapRecorderError(error) })
      return
    }

    startedAtRef.current = performance.now()
    lastLevelAtRef.current = 0
    setState({ status: 'recording', error: null, elapsedMs: 0, level: 0, recording: null, previewUrl: null })

    // 최대 길이는 탭이 숨겨져도 동작하는 타이머가 책임진다. rAF 루프는 표시 전용이다.
    timeoutRef.current = window.setTimeout(stop, maxMs)

    const samples = new Float32Array(analyserRef.current?.fftSize ?? 0)
    const tick = (now: number) => {
      const elapsed = now - startedAtRef.current
      if (now - lastLevelAtRef.current >= LEVEL_INTERVAL_MS) {
        lastLevelAtRef.current = now
        let level = 0
        if (analyserRef.current) {
          analyserRef.current.getFloatTimeDomainData(samples)
          level = levelFromSamples(samples)
        }
        setState((prev) =>
          prev.status === 'recording' ? { ...prev, elapsedMs: Math.min(maxMs, Math.round(elapsed)), level } : prev,
        )
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [maxMs, releaseHardware, revokePreview, stop])

  const reset = useCallback(() => {
    dispose()
    setState(INITIAL)
  }, [dispose])

  useEffect(() => dispose, [dispose])

  return { ...state, start, stop, reset }
}
