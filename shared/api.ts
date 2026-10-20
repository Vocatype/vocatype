import type { Locale } from './locale.ts'
import type { TypeCode } from './typeCode.ts'

/** 클라이언트와 Worker가 함께 쓰는 API 계약. 개인정보가 담길 수 있는 필드는 없다. */

export type AiProviderName = 'mock' | 'workers-ai'
/** 텍스트(목소리 리딩) 제공자. 이미지 제공자와 별도로 켜지며, 폴백 체인(workers-ai → claude → mock)으로 쓰인다. */
export type TextProviderName = 'mock' | 'workers-ai' | 'claude'

export interface ApiConfigResponse {
  provider: AiProviderName
  /** 리딩 폴백 체인에 든 제공자(순서대로). 비어 있으면 리딩 기능이 꺼진 것이다. mock 은 포함하지 않는다. */
  textProviders: TextProviderName[]
  features: {
    /** true면 클라이언트가 /api/portrait 를 호출한다. */
    portrait: boolean
    /** true면 클라이언트가 /api/reading 을 호출한다. */
    reading: boolean
  }
}

export interface PortraitRequest {
  typeCode: TypeCode
  /** 0 이상의 정수. 같은 녹음이면 같은 값이라 같은 얼굴이 나온다. */
  seed: number
}

export interface PortraitResponse {
  /** data URL. 제공자가 이미지를 만들지 않으면 null. */
  image: string | null
  provider: AiProviderName
}

export interface ApiErrorResponse {
  error: 'not_found' | 'method_not_allowed' | 'forbidden' | 'rate_limited' | 'invalid_request' | 'too_large' | 'provider_failed'
}

/** /api/portrait 요청 본문 최대 크기(바이트). 타입 코드와 씨앗뿐이라 넉넉히 1KB. */
export const PORTRAIT_REQUEST_MAX_BYTES = 1024

/** 씨앗 상한. Workers AI seed 입력은 32비트 정수면 충분하다. */
export const SEED_MAX = 0xffffffff

/** 클라이언트가 받아들이는 초상 data URL의 최대 길이(약 4MB). */
export const PORTRAIT_IMAGE_MAX_CHARS = 4 * 1024 * 1024

/* ---------- 목소리 리딩 ---------- */

/** 리딩 요청에 들어가는 여섯 축. 분석의 VoiceAxes 와 같은 키다. */
export const READING_AXIS_KEYS = ['warmth', 'density', 'pace', 'variation', 'pitch', 'brightness'] as const
export type ReadingAxisKey = (typeof READING_AXIS_KEYS)[number]
/** 모두 0..1. 소수 둘째 자리로 반올림해 보낸다(필요 이상의 정밀도를 보내지 않는다). */
export type ReadingAxes = Record<ReadingAxisKey, number>

export interface ReadingRequest {
  typeCode: TypeCode
  axes: ReadingAxes
  /** 리딩을 쓸 언어. 생성 시점의 화면 언어다. */
  locale: Locale
}

export interface ReadingResponse {
  /** 3~4문장 한 문단. */
  reading: string
  /** 공유용 한 줄. */
  caption: string
  /** 실제로 답한 제공자. 체인이 모두 실패하면 'mock'이며, 클라이언트는 이때 리딩이 없는 것으로 본다. */
  provider: TextProviderName
}

/** /api/reading 요청 본문 최대 크기(바이트). 타입 코드·여섯 수치·로케일뿐이라 1KB면 넉넉하다. */
export const READING_REQUEST_MAX_BYTES = 1024

/*
 * 리딩 시간 규칙: Worker 체인 예산 < 클라이언트 대기 시간 (shared/api.test.ts 가 검사한다).
 * 체인은 예산 안에 반드시 답(최악이면 mock 고정 문구)을 돌려주고, 클라이언트는 그보다 오래 기다린다.
 * 그래야 클라이언트가 포기한 뒤에 Worker 가 다음 제공자를 새로 불러 할당량·비용을 쓰는 일이 없다. 체인 순서(TEXT_PROVIDER)와 상관없이 성립한다.
 * 차이(5초)는 네트워크 왕복과 Worker 처리 여유로 잡은 값이다.
 */
/** Worker 리딩 체인 전체(모든 제공자·재시도·retry-after 대기 포함)의 시간 예산. 제공자에게는 남은 예산이 중단 신호로 간다. */
export const READING_CHAIN_BUDGET_MS = 25_000
/** 클라이언트가 /api/reading 응답을 기다리는 시간. 초상 요청과 병렬이라 전체 대기는 늘지 않는다. */
export const READING_CLIENT_TIMEOUT_MS = 30_000

/** 서버와 클라이언트가 함께 지키는 길이 범위. 벗어나면 제공자 실패로 본다. */
export const READING_MIN_CHARS = 20
export const READING_MAX_CHARS = 600
export const CAPTION_MIN_CHARS = 2
export const CAPTION_MAX_CHARS = 100
