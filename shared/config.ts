/**
 * 서비스 전역 상수.
 * 서비스 이름은 아직 확정 전이므로 이 파일 한 곳에서만 바꾼다.
 * 앱(src), Worker(worker), Vite 설정(index.html 치환)이 모두 이 값을 읽는다.
 */
export const SERVICE_NAME = 'VoicePortrait'

/** 녹음 길이 제한(초). 최소보다 짧으면 분석이 불안정하고, 최대에 닿으면 자동으로 끝낸다. */
export const RECORDING_MIN_SECONDS = 3
export const RECORDING_MAX_SECONDS = 30
