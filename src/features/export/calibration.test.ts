import { describe, expect, it } from 'vitest'
import { AXIS_RANGES } from '../analysis/axes'
import { spectralTilt } from '../analysis/dsp'
import type { VoiceFeatures } from '../analysis/features'
import { ANALYSIS_VERSION } from '../analysis/version'
import type { VoiceProfile } from '../profile/types'
import type { Capture } from '../recorder/types'
import {
  buildCalibrationExport,
  CALIBRATION_SCHEMA,
  CALIBRATION_SCHEMA_VERSION,
  calibrationBlob,
  calibrationFilename,
  isCalibrationEnabled,
  normalizedTilt,
  serializeCalibration,
  type CalibrationCapture,
} from './calibration'

const features: VoiceFeatures = {
  durationSec: 12,
  sampleRate: 16000,
  frameCount: 370,
  energeticFrameCount: 300,
  voicedFrameCount: 250,
  speechRatio: 0.8,
  f0Median: 150,
  f0Variation: 0.2,
  f0Low: 120,
  f0High: 190,
  rmsMean: 0.08,
  rmsVariation: 0.5,
  zcrMean: 0.07,
  tiltMedian: 0.18,
  syllableRate: 4.2,
  pauseCount: 3,
  envelope: [0.2, 0.9, 1, 0.4],
}

const profile: VoiceProfile = {
  typeCode: 'WFME',
  axes: { warmth: 0.8, density: 0.52, pace: 0.2, variation: 0.45, pitch: 0.4, brightness: 0.4 },
  features,
  seed: 2893421043,
  quality: 'ok',
}

/** 화면이 넘기는 실제 Capture 모양. 음성 Blob을 읽으면 예외를 던져, 내보내기가 오디오에 손대지 않음을 증명한다. */
const capture: Capture = {
  script: { id: 'ko-seosi', locale: 'ko', title: '서시', author: '윤동주', year: '1941', excerpt: false, lines: ['죽는 날까지 하늘을 우러러'] },
  recording: {
    durationMs: 23456,
    mimeType: 'audio/webm',
    get blob(): Blob {
      throw new Error('audio must not be read')
    },
  },
}
// 내보내기 함수의 매개변수 타입은 Capture의 일부(글 id·언어·길이)만 받는다. 실제 Capture가 그대로 들어가는지 타입으로 확인.
const asCalibrationCapture: CalibrationCapture = capture
void asCalibrationCapture

/** 중첩 객체의 모든 키를 "a.b.c" 경로로 모은다. 배열 안은 보지 않는다. */
function allKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value).flatMap(([key, child]) => [`${prefix}${key}`, ...allKeys(child, `${prefix}${key}.`)])
}

describe('buildCalibrationExport 스키마', () => {
  it('최상위 키 집합과 식별자가 스키마 1판대로 고정된다', () => {
    const record = buildCalibrationExport(profile, capture, 'en')
    expect(Object.keys(record)).toEqual([
      'schema',
      'schemaVersion',
      'analysisVersion',
      'locale',
      'scriptId',
      'durationMs',
      'quality',
      'typeCode',
      'seed',
      'axes',
      'features',
      'derived',
      'axisRanges',
    ])
    expect(record.schema).toBe(CALIBRATION_SCHEMA)
    expect(record.schemaVersion).toBe(CALIBRATION_SCHEMA_VERSION)
    expect(record.analysisVersion).toBe(ANALYSIS_VERSION)
    expect(Object.keys(record.derived)).toEqual(['tiltNormalized'])
    expect(record.axisRanges).toEqual(AXIS_RANGES)
  })

  it('axisRanges는 전역 상수의 복사본이라 레코드를 바꿔도 축 계산에 영향이 없다', () => {
    const record = buildCalibrationExport(profile, capture, 'en')
    expect(record.axisRanges).not.toBe(AXIS_RANGES)
    expect(record.axisRanges.pace).not.toBe(AXIS_RANGES.pace)
    ;(record.axisRanges as unknown as { pitch: number[] }).pitch[0] = 1
    expect(AXIS_RANGES.pitch[0]).toBe(85)
  })

  it('features는 VoiceFeatures에서 envelope만 뺀 전체에 envelopeLength를 더한 것이다', () => {
    const record = buildCalibrationExport(profile, capture, 'en')
    // VoiceFeatures에 필드가 늘면 buildCalibrationExport가 먼저 컴파일에 실패하고(허용 목록), 여기서도 실패한다.
    // 이 목록을 갱신하기 전에 새 필드가 음성·시계열이 아닌지 확인하고 schemaVersion을 올린다.
    expect(Object.keys(record.features).sort()).toEqual(
      [
        'durationSec',
        'sampleRate',
        'frameCount',
        'energeticFrameCount',
        'voicedFrameCount',
        'speechRatio',
        'f0Median',
        'f0Variation',
        'f0Low',
        'f0High',
        'rmsMean',
        'rmsVariation',
        'zcrMean',
        'tiltMedian',
        'syllableRate',
        'pauseCount',
        'envelopeLength',
      ].sort(),
    )
    expect(Object.keys(record.features).sort()).toEqual([...Object.keys(features).filter((key) => key !== 'envelope'), 'envelopeLength'].sort())
    for (const [key, value] of Object.entries(features)) if (key !== 'envelope') expect(record.features[key as keyof typeof record.features], key).toBe(value)
    expect(record.features.envelopeLength).toBe(4)
  })

  it('여섯 축·타입 코드·씨앗·품질과 캡처의 언어·글 id·녹음 길이가 그대로 들어간다', () => {
    const record = buildCalibrationExport(profile, capture, 'en')
    expect(record.axes).toEqual(profile.axes)
    expect(Object.keys(record.axes)).toHaveLength(6)
    expect(record.typeCode).toBe('WFME')
    expect(record.seed).toBe(2893421043)
    expect(record.quality).toBe('ok')
    expect(record.locale).toBe('ko')
    expect(record.scriptId).toBe('ko-seosi')
    expect(record.durationMs).toBe(23456)
  })

  it('캡처가 없으면 화면 언어와 분석 길이를 쓴다', () => {
    const record = buildCalibrationExport(profile, null, 'en')
    expect(record.locale).toBe('en')
    expect(record.scriptId).toBeNull()
    expect(record.durationMs).toBe(12000)
  })

  it('입력이 같으면 JSON 문자열도 같다', () => {
    expect(serializeCalibration(buildCalibrationExport(profile, capture, 'en'))).toBe(serializeCalibration(buildCalibrationExport(profile, capture, 'en')))
  })
})

describe('음성·개인정보 부재', () => {
  it('음성 Blob을 읽지 않고, envelope·blob 같은 음성 키가 어디에도 없다', () => {
    expect(() => buildCalibrationExport(profile, capture, 'en')).not.toThrow()
    const record = buildCalibrationExport(profile, capture, 'en')
    const keys = allKeys(record)
    expect(keys).not.toContain('features.envelope')
    const forbidden = new Set([
      'envelope',
      'blob',
      'audio',
      'samples',
      'pcm',
      'recording',
      'mimeType',
      'previewUrl',
      'frames',
      'waveform',
      'spectrum',
      'buffer',
      'signal',
      'url',
    ])
    for (const path of keys) expect(forbidden.has(path.split('.').at(-1) ?? ''), path).toBe(false)
    expect(allKeys(record).some((path) => path.startsWith('features.envelope.'))).toBe(false)
    // 긴 배열(시계열)이 어떤 키로도 들어가지 않는다. 축 범위의 [low, high] 쌍만 배열이다. 중첩 배열 안도 본다.
    const walk = (value: unknown, path: string) => {
      if (Array.isArray(value)) {
        expect(value.length, path).toBeLessThanOrEqual(2)
        value.forEach((child, i) => walk(child, `${path}[${i}]`))
      } else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`)
      }
    }
    walk(JSON.parse(serializeCalibration(record)), 'record')
  })

  it('시각·사용자 에이전트·IP·기기 같은 식별 정보 키가 없다', () => {
    const record = buildCalibrationExport(profile, capture, 'en')
    const pattern = /time|date|stamp|agent|address|device|platform|user|mail|^ip$|geo|location|name|browser|os$/i
    for (const path of allKeys(record)) expect(pattern.test(path.split('.').at(-1) ?? ''), path).toBe(false)
  })

  it('JSON은 숫자·문자열·null·배열·객체만 담고 작다', () => {
    const record = buildCalibrationExport(profile, capture, 'en')
    const text = serializeCalibration(record)
    expect(JSON.parse(text)).toEqual(record)
    expect(text.length).toBeLessThan(2000)
  })
})

describe('normalizedTilt', () => {
  it('tiltMedian / (2π·f0Median / sampleRate)', () => {
    expect(normalizedTilt(features)).toBeCloseTo(0.18 / ((2 * Math.PI * 150) / 16000), 6)
    expect(buildCalibrationExport(profile, capture, 'en').derived.tiltNormalized).toBeCloseTo(3.0558, 3)
  })

  it('f0가 없으면 null', () => {
    expect(normalizedTilt({ ...features, f0Median: 0 })).toBeNull()
    expect(normalizedTilt({ ...features, sampleRate: 0 })).toBeNull()
    const silent = buildCalibrationExport({ ...profile, quality: 'low-signal', features: { ...features, f0Median: 0, voicedFrameCount: 0 } }, capture, 'en')
    expect(silent.derived.tiltNormalized).toBeNull()
    expect(silent.quality).toBe('low-signal')
  })

  it('순음에서는 1에 가깝고 배음이 더해지면 커진다', () => {
    // 125Hz는 16kHz에서 주기 128샘플이라 1024 창에 정확히 8주기가 든다.
    const sampleRate = 16000
    const f0 = 125
    const pure = new Float32Array(1024)
    const rich = new Float32Array(1024)
    for (let i = 0; i < pure.length; i += 1) {
      const phase = (2 * Math.PI * f0 * i) / sampleRate
      pure[i] = Math.sin(phase)
      rich[i] = Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.3 * Math.sin(3 * phase)
    }
    const pureValue = normalizedTilt({ tiltMedian: spectralTilt(pure), f0Median: f0, sampleRate })
    const richValue = normalizedTilt({ tiltMedian: spectralTilt(rich), f0Median: f0, sampleRate })
    expect(pureValue).toBeCloseTo(1, 2)
    expect(richValue).toBeGreaterThan(1.3)
  })
})

describe('파일 이름·Blob·플래그', () => {
  it('파일 이름은 <서비스>-calib-<locale>-<typeCode>-<seed>.json', () => {
    const record = buildCalibrationExport(profile, capture, 'en')
    expect(calibrationFilename(record)).toBe('vocatype-calib-ko-WFME-2893421043.json')
    expect(calibrationFilename(record, 'My App')).toMatch(/^my app-calib-ko-WFME-2893421043\.json$/)
    expect(calibrationFilename(record)).toMatch(/^[a-z0-9-]+-calib-(ko|en)-[WC][FL][QM][VE]-\d+\.json$/)
  })

  it('Blob은 application/json이고 2칸 들여쓰기 JSON에 끝 줄바꿈이 있다', async () => {
    const record = buildCalibrationExport(profile, capture, 'en')
    const blob = calibrationBlob(record)
    expect(blob.type).toBe('application/json')
    const text = await blob.text()
    expect(text).toBe(serializeCalibration(record))
    expect(text.startsWith('{\n  "schema": ')).toBe(true)
    expect(text.endsWith('}\n')).toBe(true)
  })

  it('isCalibrationEnabled는 calibrate=1일 때만 참', () => {
    expect(isCalibrationEnabled('?calibrate=1')).toBe(true)
    expect(isCalibrationEnabled('?lang=ko&calibrate=1')).toBe(true)
    expect(isCalibrationEnabled('')).toBe(false)
    expect(isCalibrationEnabled('?calibrate=0')).toBe(false)
    expect(isCalibrationEnabled('?calibrate')).toBe(false)
    expect(isCalibrationEnabled('?calibrate=true')).toBe(false)
    expect(isCalibrationEnabled('?other=1')).toBe(false)
  })
})
