import type { TypeCode } from './typeCode.ts'

/** 클라이언트와 Worker가 함께 쓰는 API 계약. 개인정보가 담길 수 있는 필드는 없다. */

export type AiProviderName = 'mock' | 'workers-ai'

export interface ApiConfigResponse {
  provider: AiProviderName
  features: {
    /** true면 클라이언트가 /api/portrait 를 호출한다. */
    portrait: boolean
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
