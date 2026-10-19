import type { Script } from '../scripts/scripts'

export interface Recording {
  /** 브라우저가 만든 압축 오디오. 기기 밖으로 내보내지 않는다. */
  blob: Blob
  mimeType: string
  durationMs: number
}

/** 녹음 화면이 다음 단계로 넘기는 묶음. */
export interface Capture {
  script: Script
  recording: Recording
}
