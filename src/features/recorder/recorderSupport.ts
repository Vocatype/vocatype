export type RecorderError = 'permission-denied' | 'no-microphone' | 'busy' | 'unsupported' | 'unknown'

/** 브라우저가 지원하는 첫 mime 타입. 없으면 빈 문자열(브라우저 기본값에 맡김). */
export const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const

export function pickMimeType(isTypeSupported: (type: string) => boolean): string {
  for (const type of MIME_CANDIDATES) {
    try {
      if (isTypeSupported(type)) return type
    } catch {
      // 일부 브라우저는 알 수 없는 타입에 예외를 던진다. 다음 후보로.
    }
  }
  return ''
}

/** getUserMedia / MediaRecorder 예외를 사용자가 조치할 수 있는 종류로 줄인다. */
export function mapRecorderError(error: unknown): RecorderError {
  const name = error instanceof Error ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'permission-denied'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'no-microphone'
    case 'NotReadableError':
    case 'AbortError':
    case 'TrackStartError':
      return 'busy'
    case 'TypeError':
    case 'NotSupportedError':
      return 'unsupported'
    default:
      return 'unknown'
  }
}

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  )
}

/** 밀리초를 m:ss 로. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** 시간 영역 샘플의 RMS를 0..1 레벨로. 말소리 RMS는 보통 0.02~0.25라 4배로 키운다. */
export function levelFromSamples(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i] ?? 0
    sum += value * value
  }
  const rms = Math.sqrt(sum / samples.length)
  return Math.min(1, rms * 4)
}
