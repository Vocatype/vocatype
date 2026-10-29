import { PORTRAIT_SERVER_TIMEOUT_MS } from '../../shared/api.ts'
import type { AiProvider, PortraitInput, PortraitOutput } from './types.ts'
import { detectImageMime } from './workersAi.ts'

export const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations'
/** 기본 모델. 2.5 flare 는 "빠르고 품질 높은 일상 생성용"(031 조사). `IMAGE_MODEL` 변수로 바꿀 수 있다. */
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2.5-flare'
/**
 * 표준 크기 세 가지 중 정사각형. 결과 카드가 1:1로 쓴다.
 * 816×816 같은 사용자 정의 크기도 되지만(16의 배수, 총 655,360픽셀 이상) 2.5 의 크기별 토큰 수가 공개되지 않아 실측 전에는 표준 크기를 쓴다.
 */
export const OPENAI_PORTRAIT_SIZE = '1024x1024'
/**
 * 사용자 결정(031). low 는 얼굴 디테일이, high 는 비용·시간이 아쉽다.
 * 2.5 의 장당 가격은 공개되지 않았다(모델 페이지: GPT Image 2 계산기는 2.5 를 추정하지 않는다. 가이드의 2.5·2 공용 계산기 값은 글로 확인하지 못했다). 제3자 자료는 1024×1024 medium 약 $0.013, 같은 토큰 단가인 GPT Image 2 공식 표는 $0.053.
 * 2026-10-29 운영 실측 1장: 입력 84 / 출력 439토큰 → 장당 약 $0.0136(제3자 수치 쪽). 값은 `[portrait] openai … out=…` 로그로 확인한다.
 */
export const OPENAI_PORTRAIT_QUALITY = 'medium'
/** `output_compression`(0~100, 기본 100). jpeg 는 png 보다 빠르고(공식 가이드) 1024×1024 가 수백 KB 라 클라이언트 상한(PORTRAIT_IMAGE_MAX_CHARS) 안에 넉넉히 든다. */
export const OPENAI_OUTPUT_COMPRESSION = 90

/** 모델 이름은 `gpt-image-`로 시작하는 식별자만 받는다. 설정 오타나 이상한 값이 요청에 실리지 않게 한다. */
export function isImageModel(value: unknown): value is string {
  return typeof value === 'string' && /^gpt-image-[a-z0-9][a-z0-9.-]{0,63}$/.test(value)
}

export function resolveImageModel(value: string | undefined): string {
  return isImageModel(value) ? value : DEFAULT_IMAGE_MODEL
}

export interface OpenAiImageProviderOptions {
  apiKey: string
  model?: string
  timeoutMs?: number
  /** 테스트용. 기본은 전역 fetch. */
  fetch?: typeof fetch
}

interface ImagesResponse {
  data?: { b64_json?: unknown }[]
  usage?: { input_tokens?: number; output_tokens?: number }
}

interface ImagesErrorResponse {
  error?: { code?: unknown; type?: unknown }
}

/** 요청 본문. 프롬프트는 서버가 타입 코드로만 만든다. seed 는 이 API 에 없어 보내지 않는다. */
export function buildImageRequest(input: PortraitInput, model: string) {
  return {
    model,
    prompt: input.prompt,
    n: 1,
    size: OPENAI_PORTRAIT_SIZE,
    quality: OPENAI_PORTRAIT_QUALITY,
    output_format: 'jpeg',
    output_compression: OPENAI_OUTPUT_COMPRESSION,
  }
}

/** 실패 응답에서 상태와 오류 코드만 꺼낸다. 본문 메시지는 로그·응답 어디에도 싣지 않는다. */
async function describeFailure(response: Response): Promise<string> {
  let code = ''
  try {
    const body = (await response.json()) as ImagesErrorResponse
    const value = body.error?.code ?? body.error?.type
    if (typeof value === 'string' && /^[a-z0-9_.-]{1,64}$/i.test(value)) code = ` ${value}`
  } catch {
    // 본문이 JSON 이 아니면 상태만 남긴다.
  }
  return `HTTP ${response.status}${code}`
}

/**
 * OpenAI GPT 이미지 제공자. 결과는 base64 이미지이며 저장하지 않고 응답으로만 돌려준다.
 * 호출은 `timeoutMs`(기본 PORTRAIT_SERVER_TIMEOUT_MS, shared/api.ts 의 초상 시간 규칙)에서 fetch 신호로 끊는다. 끊으면 TimeoutError 로 실패하고 라우트는 503 으로 답한다.
 * 같은 씨앗이라도 매번 다른 얼굴이 나온다(seed 미지원). 한 녹음에 한 번만 부르므로 사용자에게 보이는 차이는 없다.
 */
export function createOpenAiImageProvider(options: OpenAiImageProviderOptions): AiProvider {
  const model = options.model ?? DEFAULT_IMAGE_MODEL
  const timeoutMs = options.timeoutMs ?? PORTRAIT_SERVER_TIMEOUT_MS
  const doFetch = options.fetch ?? fetch
  return {
    name: 'openai',
    supportsPortrait: true,
    async generatePortrait(input: PortraitInput): Promise<PortraitOutput> {
      // 같은 신호가 본문 읽기까지 덮는다(본문은 base64 이미지라 크다).
      const signal = AbortSignal.timeout(timeoutMs)
      const response = await doFetch(OPENAI_IMAGES_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${options.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(buildImageRequest(input, model)),
        signal,
      })
      if (!response.ok) throw Object.assign(new Error(await describeFailure(response)), { name: 'OpenAiError' })
      let result: ImagesResponse | null
      try {
        result = (await response.json()) as ImagesResponse | null
      } catch (cause) {
        if (signal.aborted) throw cause
        // 성공 상태인데 본문이 JSON 이 아니거나 잘렸다. 파서 오류 메시지에는 본문 일부가 들어가므로 그대로 던지지 않는다.
        throw Object.assign(new Error(`HTTP ${response.status} invalid_body`), { name: 'OpenAiError' })
      }
      // 비용 추적용 토큰 수만 남긴다(사용자 데이터 없음). 운영에서는 observability 가 꺼져 있어 어디에도 저장되지 않는다.
      console.info(`[portrait] openai ${model} in=${result?.usage?.input_tokens ?? '?'} out=${result?.usage?.output_tokens ?? '?'}`)
      const image = result?.data?.[0]?.b64_json
      if (typeof image !== 'string' || !image) return { image: null }
      const mime = detectImageMime(image)
      if (!mime) return { image: null }
      return { image: `data:${mime};base64,${image}` }
    },
  }
}
