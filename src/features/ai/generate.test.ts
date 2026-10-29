import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiConfigResponse } from '../../../shared/api'
import { analyzeRecording, type AnalysisProgress } from '../analysis/analyze'
import type { Locale } from '../../i18n/locales'
import type { VoiceProfile } from '../profile/types'
import type { Capture } from '../recorder/types'
import { resetAiConfigCache } from './client'
import { runGeneration, type GenerateOptions, type WaitingStage } from './generate'

/*
 * 생성 흐름(분석 → 설정 → 초상·리딩 병렬 요청)의 순서·취소·단계 규칙을 검사한다.
 * 분석은 OfflineAudioContext 가 필요해 node 에서 돌지 않으므로 가짜로 바꾸고,
 * 요청은 실제 client 코드를 거쳐 fetch 스텁에 닿게 해 본문 형식과 null 처리까지 함께 본다.
 */
vi.mock('../analysis/analyze', () => ({ analyzeRecording: vi.fn() }))
const analyze = vi.mocked(analyzeRecording)

/* ---------- 픽스처 ---------- */

// 낭독 언어(en)와 화면 언어(ko)를 다르게 둬서 분석과 리딩이 각자 맞는 언어를 받는지 가려낸다.
const capture: Capture = {
  script: { id: 'fixture', locale: 'en', title: 'Fixture', author: 'Tester', year: '2026', excerpt: false, lines: ['A line to read aloud.'] },
  recording: { blob: new Blob(['audio'], { type: 'audio/webm' }), mimeType: 'audio/webm', durationMs: 12_000 },
}

function makeProfile(overrides: Partial<VoiceProfile> = {}): VoiceProfile {
  return {
    typeCode: 'WFME',
    // 소수 셋째 자리 이하가 있어 리딩 본문에서 반올림되는지 보인다.
    axes: { warmth: 0.8123, density: 0.52, pace: 0.2, variation: 0.456, pitch: 0.4, brightness: 0.4 },
    features: {
      durationSec: 12,
      sampleRate: 16000,
      frameCount: 370,
      energeticFrameCount: 300,
      voicedFrameCount: 250,
      speechRatio: 0.8,
      f0Median: 142,
      f0Variation: 0.2,
      f0Low: 110,
      f0High: 190,
      rmsMean: 0.08,
      rmsVariation: 0.5,
      zcrMean: 0.05,
      tiltMedian: 0.15,
      syllableRate: 4.2,
      pauseCount: 2,
      envelope: [0.3, 0.6, 0.9],
    },
    seed: 4242,
    quality: 'ok',
    ...overrides,
  }
}

const IMAGE = 'data:image/png;base64,QUJD'
const READING_TEXT = '따뜻하고 단단한 소리가 천천히 이어져요.'
const CAPTION = '기대게 되는 목소리'

/* ---------- fetch 스텁 ---------- */

type ApiPath = '/api/config' | '/api/portrait' | '/api/reading'
type Handler = (init: RequestInit | undefined) => Response | Promise<Response>

function configOf(portrait: boolean, reading: boolean): Handler {
  const body: ApiConfigResponse = { provider: 'workers-ai', textProviders: reading ? ['claude'] : [], features: { portrait, reading } }
  return () => Response.json(body)
}
const portraitOk: Handler = () => Response.json({ image: IMAGE, provider: 'workers-ai' })
const readingOk: Handler = () => Response.json({ reading: READING_TEXT, caption: CAPTION, provider: 'claude' })
const httpError: Handler = () => new Response('', { status: 503 })
const networkError: Handler = () => Promise.reject(new TypeError('Failed to fetch'))
/** 취소될 때까지 끝나지 않는 응답. 실제 fetch 처럼 신호가 끊기면(이미 끊겨 있어도) AbortError 로 거부한다. */
const untilAborted: Handler = (init) =>
  new Promise((_resolve, reject) => {
    const abort = () => reject(new DOMException('aborted', 'AbortError'))
    if (init?.signal?.aborted) abort()
    else init?.signal?.addEventListener('abort', abort)
  })

/** 경로별 응답을 정해 fetch 를 바꾼다. 정하지 않은 경로는 네트워크 오류. */
function stubApi(handlers: Partial<Record<ApiPath, Handler>>) {
  const fetchMock = vi.fn((input: string, init?: RequestInit) => {
    const handler = handlers[input as ApiPath]
    return handler ? Promise.resolve(handler(init)) : Promise.reject(new TypeError(`unexpected ${input}`))
  })
  vi.stubGlobal('fetch', fetchMock)
  const callOf = (path: ApiPath) => fetchMock.mock.calls.find(([input]) => input === path)
  return {
    /** 요청을 보낸 순서대로의 경로. */
    paths: () => fetchMock.mock.calls.map(([input]) => input),
    body: (path: ApiPath): unknown => {
      const call = callOf(path)
      return call ? JSON.parse(String(call[1]?.body)) : undefined
    },
    signal: (path: ApiPath) => callOf(path)?.[1]?.signal ?? undefined,
  }
}

/* ---------- 도우미 ---------- */

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

/** 응답 본문 읽기와 그 뒤의 마이크로태스크가 끝나도록 매크로태스크를 몇 차례 넘긴다. */
async function settle() {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0))
}

/** 콜백 기록과 함께 실행한다. */
function run(options: Partial<GenerateOptions> = {}) {
  const progress: AnalysisProgress[] = []
  const stages: WaitingStage[] = []
  const pending = runGeneration(capture, {
    getLocale: () => 'ko',
    onProgress: (next) => progress.push(next),
    onStage: (stage) => stages.push(stage),
    ...options,
  })
  return { pending, progress, stages }
}

const PROFILE = makeProfile()

beforeEach(() => {
  analyze.mockImplementation(async (_recording, options) => {
    options?.onProgress?.({ stage: 'decoding', progress: 0 })
    options?.onProgress?.({ stage: 'profiling', progress: 1 })
    return PROFILE
  })
})

afterEach(() => {
  analyze.mockReset()
  vi.unstubAllGlobals()
  resetAiConfigCache()
})

describe('runGeneration 정상 흐름', () => {
  it('설정 조회를 분석과 동시에 시작하고, 분석 진행을 전달한 뒤 켜진 요청을 보내 결과를 모은다', async () => {
    const api = stubApi({ '/api/config': configOf(true, true), '/api/portrait': portraitOk, '/api/reading': readingOk })
    let pathsDuringAnalysis: string[] = []
    analyze.mockImplementation(async (_recording, options) => {
      pathsDuringAnalysis = api.paths()
      options?.onProgress?.({ stage: 'extracting', progress: 0.5 })
      return PROFILE
    })
    const controller = new AbortController()
    const { pending, progress, stages } = run({ signal: controller.signal })
    const result = await pending

    expect(pathsDuringAnalysis).toEqual(['/api/config'])
    expect(analyze).toHaveBeenCalledTimes(1)
    const [recording, options] = analyze.mock.calls[0]!
    expect(recording).toBe(capture.recording)
    expect(options?.locale).toBe('en')
    // toMatchObject 는 AbortSignal 을 구조로 비교해 다른 신호도 같다고 본다. 같은 객체인지 본다.
    expect(options?.signal).toBe(controller.signal)
    expect(progress).toEqual([{ stage: 'extracting', progress: 0.5 }])
    // 두 요청이 거의 함께 끝나므로 뒤따르는 'reading' 전환 여부는 여기서 보지 않는다(아래 단계 전환 테스트).
    expect(stages[0]).toBe('portrait')

    expect([...api.paths()].sort()).toEqual(['/api/config', '/api/portrait', '/api/reading'])
    // 키까지 정확히 같아야 한다: 음성·특징값·원래 정밀도의 축은 보내지 않는다.
    // 초상도 리딩과 같은 반올림 축을 보낸다(035).
    const readingAxes = (api.body('/api/reading') as { axes: Record<string, number> }).axes
    expect(api.body('/api/portrait')).toEqual({ typeCode: 'WFME', seed: 4242, axes: readingAxes })
    expect(Object.keys(readingAxes).sort()).toEqual(['brightness', 'density', 'pace', 'pitch', 'variation', 'warmth'])
    expect(api.body('/api/reading')).toEqual({
      typeCode: 'WFME',
      axes: { warmth: 0.81, density: 0.52, pace: 0.2, variation: 0.46, pitch: 0.4, brightness: 0.4 },
      locale: 'ko',
    })
    expect(api.signal('/api/portrait')?.aborted).toBe(false)

    expect(result.profile).toBe(PROFILE)
    expect(result).toEqual({ profile: PROFILE, portrait: IMAGE, reading: { locale: 'ko', reading: READING_TEXT, caption: CAPTION } })
  })

  it('리딩 언어는 요청을 보내는 순간에 읽는다(분석 중에 화면 언어가 바뀌면 바뀐 언어)', async () => {
    const api = stubApi({ '/api/config': configOf(false, true), '/api/reading': readingOk })
    let locale: Locale = 'ko'
    analyze.mockImplementation(async () => {
      locale = 'en'
      return PROFILE
    })
    const result = await run({ getLocale: () => locale }).pending

    expect(api.body('/api/reading')).toMatchObject({ locale: 'en' })
    expect(result.reading?.locale).toBe('en')
  })
})

describe('runGeneration 무엇을 요청할지', () => {
  it.each([
    { name: '초상만 켜짐', config: configOf(true, false), paths: ['/api/config', '/api/portrait'], stages: ['portrait'], portrait: IMAGE, reading: null },
    { name: '리딩만 켜짐', config: configOf(false, true), paths: ['/api/config', '/api/reading'], stages: ['reading'], portrait: null, reading: READING_TEXT },
    { name: '둘 다 꺼짐', config: configOf(false, false), paths: ['/api/config'], stages: [], portrait: null, reading: null },
    { name: '설정 조회 실패(꺼진 설정으로 봄)', config: httpError, paths: ['/api/config'], stages: [], portrait: null, reading: null },
  ])('$name', async ({ config, paths, stages: expectedStages, portrait, reading }) => {
    const api = stubApi({ '/api/config': config, '/api/portrait': portraitOk, '/api/reading': readingOk })
    const { pending, stages } = run()
    const result = await pending

    expect(api.paths()).toEqual(paths)
    expect(stages).toEqual(expectedStages)
    expect(result.portrait).toBe(portrait)
    expect(result.reading?.reading ?? null).toBe(reading)
  })

  it('목소리가 거의 잡히지 않은(low-signal) 녹음은 리딩이 켜져 있어도 리딩을 요청하지 않는다', async () => {
    const api = stubApi({ '/api/config': configOf(true, true), '/api/portrait': portraitOk, '/api/reading': readingOk })
    analyze.mockResolvedValue(makeProfile({ quality: 'low-signal' }))
    const getLocale = vi.fn((): Locale => 'ko')
    const { pending, stages } = run({ getLocale })
    const result = await pending

    expect(api.paths()).toEqual(['/api/config', '/api/portrait'])
    expect(stages).toEqual(['portrait'])
    expect(result.portrait).toBe(IMAGE)
    expect(result.reading).toBeNull()
    expect(getLocale).not.toHaveBeenCalled()
  })

  it('low-signal 이고 초상이 꺼져 있으면 요청도 대기 단계도 없다', async () => {
    const api = stubApi({ '/api/config': configOf(false, true), '/api/reading': readingOk })
    analyze.mockResolvedValue(makeProfile({ quality: 'low-signal' }))
    const { pending, stages } = run()
    const result = await pending

    expect(api.paths()).toEqual(['/api/config'])
    expect(stages).toEqual([])
    expect(result).toMatchObject({ portrait: null, reading: null })
  })
})

describe('runGeneration 대기 단계 전환', () => {
  it('초상이 먼저 끝나면 리딩을 기다리는 동안 단계를 리딩으로 바꾼다', async () => {
    const portrait = deferred<Response>()
    const reading = deferred<Response>()
    stubApi({ '/api/config': configOf(true, true), '/api/portrait': () => portrait.promise, '/api/reading': () => reading.promise })
    const { pending, stages } = run()

    await settle()
    expect(stages).toEqual(['portrait'])
    portrait.resolve(Response.json({ image: IMAGE, provider: 'workers-ai' }))
    await settle()
    expect(stages).toEqual(['portrait', 'reading'])

    reading.resolve(Response.json({ reading: READING_TEXT, caption: CAPTION, provider: 'claude' }))
    expect(await pending).toMatchObject({ portrait: IMAGE, reading: { reading: READING_TEXT } })
    expect(stages).toEqual(['portrait', 'reading'])
  })

  it('초상이 실패로 먼저 끝나도 리딩을 기다리면 단계를 리딩으로 바꾼다', async () => {
    const reading = deferred<Response>()
    stubApi({ '/api/config': configOf(true, true), '/api/portrait': httpError, '/api/reading': () => reading.promise })
    const { pending, stages } = run()

    await settle()
    expect(stages).toEqual(['portrait', 'reading'])

    reading.resolve(Response.json({ reading: READING_TEXT, caption: CAPTION, provider: 'claude' }))
    expect(await pending).toMatchObject({ portrait: null, reading: { reading: READING_TEXT } })
  })

  it('리딩이 실패로 먼저 끝난 뒤 초상이 끝나도 단계를 바꾸지 않는다', async () => {
    const portrait = deferred<Response>()
    stubApi({ '/api/config': configOf(true, true), '/api/portrait': () => portrait.promise, '/api/reading': httpError })
    const { pending, stages } = run()

    await settle()
    portrait.resolve(Response.json({ image: IMAGE, provider: 'workers-ai' }))
    expect(await pending).toMatchObject({ portrait: IMAGE, reading: null })
    expect(stages).toEqual(['portrait'])
  })

  it('리딩이 먼저 끝나면 단계를 바꾸지 않는다', async () => {
    const portrait = deferred<Response>()
    const reading = deferred<Response>()
    stubApi({ '/api/config': configOf(true, true), '/api/portrait': () => portrait.promise, '/api/reading': () => reading.promise })
    const { pending, stages } = run()

    await settle()
    // 위 테스트와 같은 settle() 이 초상 응답을 단계 전환까지 흘려보내므로, 여기서도 리딩 응답이 끝까지 처리된다.
    reading.resolve(Response.json({ reading: READING_TEXT, caption: CAPTION, provider: 'claude' }))
    await settle()
    portrait.resolve(Response.json({ image: IMAGE, provider: 'workers-ai' }))
    expect(await pending).toMatchObject({ portrait: IMAGE, reading: { reading: READING_TEXT } })
    expect(stages).toEqual(['portrait'])
  })
})

describe('runGeneration 요청 실패', () => {
  it.each([
    { name: '초상 HTTP 오류', portrait: httpError, reading: readingOk, expected: { portrait: null, reading: READING_TEXT } },
    { name: '초상 네트워크 오류', portrait: networkError, reading: readingOk, expected: { portrait: null, reading: READING_TEXT } },
    { name: '리딩 HTTP 오류', portrait: portraitOk, reading: httpError, expected: { portrait: IMAGE, reading: null } },
    { name: '리딩 네트워크 오류', portrait: portraitOk, reading: networkError, expected: { portrait: IMAGE, reading: null } },
    { name: '둘 다 실패', portrait: httpError, reading: networkError, expected: { portrait: null, reading: null } },
  ])('$name 이어도 거부하지 않고 그 값만 null', async ({ portrait, reading, expected }) => {
    stubApi({ '/api/config': configOf(true, true), '/api/portrait': portrait, '/api/reading': reading })
    const result = await run().pending

    expect(result.profile).toBe(PROFILE)
    expect(result.portrait).toBe(expected.portrait)
    expect(result.reading?.reading ?? null).toBe(expected.reading)
  })

  it('분석이 실패하면 그 오류로 거부하고 초상·리딩은 요청하지 않는다', async () => {
    const api = stubApi({ '/api/config': configOf(true, true), '/api/portrait': portraitOk, '/api/reading': readingOk })
    const failure = new Error('decode failed')
    analyze.mockRejectedValue(failure)
    const { pending, stages } = run()

    await expect(pending).rejects.toBe(failure)
    expect(api.paths()).toEqual(['/api/config'])
    expect(stages).toEqual([])
  })
})

describe('runGeneration 취소', () => {
  it('분석 중에 취소되면 설정을 기다리지 않고 바로 거부하며, 요청도 그 뒤 분석 진행 전달도 없다', async () => {
    // 설정 응답은 끝내 오지 않는다. 분석 직후에 취소를 확인하지 않으면 거부가 설정을 기다리느라 늦어진다.
    const api = stubApi({ '/api/config': () => deferred<Response>().promise, '/api/portrait': portraitOk, '/api/reading': readingOk })
    const controller = new AbortController()
    analyze.mockImplementation(async (_recording, options) => {
      options?.onProgress?.({ stage: 'decoding', progress: 0 })
      controller.abort()
      options?.onProgress?.({ stage: 'profiling', progress: 1 })
      return PROFILE
    })
    const { pending, progress, stages } = run({ signal: controller.signal })

    const outcome = await Promise.race([pending.catch((error: unknown) => error), settle().then(() => 'still pending')])
    expect(outcome).toMatchObject({ name: 'AbortError' })
    expect(progress).toEqual([{ stage: 'decoding', progress: 0 }])
    expect(stages).toEqual([])
    expect(api.paths()).toEqual(['/api/config'])
  })

  it('설정을 기다리는 중에 취소되면 설정이 와도 초상·리딩 요청과 대기 단계 없이 거부한다', async () => {
    const config = deferred<Response>()
    const api = stubApi({ '/api/config': () => config.promise, '/api/portrait': portraitOk, '/api/reading': readingOk })
    const controller = new AbortController()
    const { pending, stages } = run({ signal: controller.signal })

    await settle()
    expect(analyze).toHaveBeenCalledTimes(1)
    controller.abort()
    config.resolve(Response.json({ provider: 'workers-ai', textProviders: ['claude'], features: { portrait: true, reading: true } }))

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(api.paths()).toEqual(['/api/config'])
    expect(stages).toEqual([])
  })

  it('요청 중에 취소되면 두 요청을 끊고, 초상이 먼저 끝나도 리딩 단계로 바꾸지 않고 거부한다', async () => {
    const api = stubApi({ '/api/config': configOf(true, true), '/api/portrait': untilAborted, '/api/reading': untilAborted })
    const controller = new AbortController()
    const { pending, stages } = run({ signal: controller.signal })

    await settle()
    expect([...api.paths()].sort()).toEqual(['/api/config', '/api/portrait', '/api/reading'])
    expect(stages).toEqual(['portrait'])
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(api.signal('/api/portrait')?.aborted).toBe(true)
    expect(api.signal('/api/reading')?.aborted).toBe(true)
    expect(stages).toEqual(['portrait'])
  })
})
