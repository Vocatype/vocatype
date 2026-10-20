import { SERVICE_NAME } from '../../../shared/config'
import type { Locale } from '../../i18n/locales'
import { AXIS_RANGES } from '../analysis/axes'
import type { VoiceFeatures } from '../analysis/features'
import { ANALYSIS_VERSION } from '../analysis/version'
import type { TypeCode, VoiceAxes, VoiceProfile } from '../profile/types'
import type { Recording } from '../recorder/types'
import type { Script } from '../scripts/scripts'

/*
 * 보정용 내보내기(개발용). 녹음 한 번의 분석 결과를 사용자가 자기 기기에 JSON 파일로 내려받아
 * AXIS_RANGES를 실제 화자 분포로 보정하는 데 쓴다.
 * - 음성(Blob·PCM·포락선)은 넣지 않는다. 캡처에서는 글 id·언어·녹음 길이만 읽는다.
 * - 서버로 보내지 않고 저장소도 쓰지 않는다. 이 모듈은 순수 함수뿐이며 다운로드는 save.ts의 downloadBlob이 한다.
 * - 시각·IP·UA·기기 정보 같은 식별 정보는 넣지 않는다.
 */

/** 파일 종류 식별자. 모인 파일을 처리하는 스크립트가 이 값으로 가려낸다. */
export const CALIBRATION_SCHEMA = 'voice-axis-calibration'
/** JSON 모양의 판. 키를 더하거나 빼면 올린다(테스트가 키 집합을 고정한다). */
export const CALIBRATION_SCHEMA_VERSION = 1
/** 결과 화면에 내보내기 카드를 보이게 하는 URL 쿼리. `?calibrate=1` */
export const CALIBRATION_QUERY_KEY = 'calibrate'

/** 원시 특징에서 envelope(말하는 구간의 프레임별 에너지 시계열)를 빼고 길이만 남긴 것. */
export type CalibrationFeatures = Omit<VoiceFeatures, 'envelope'> & { envelopeLength: number }

export interface CalibrationExport {
  schema: typeof CALIBRATION_SCHEMA
  schemaVersion: typeof CALIBRATION_SCHEMA_VERSION
  analysisVersion: number
  /** 낭독한 글의 언어. 축 계산(pace 범위)에 쓴 언어와 같다. */
  locale: Locale
  /** 낭독 글 id. 캡처가 없으면 null. */
  scriptId: string | null
  /** 녹음 길이. 캡처가 없으면 분석 길이(durationSec)로 대신한다. */
  durationMs: number
  quality: VoiceProfile['quality']
  typeCode: TypeCode
  /** 특징 해시(초상 요청에 이미 보내는 값). 같은 녹음이면 같아 중복 파일을 가려낼 수 있다. */
  seed: number
  axes: VoiceAxes
  features: CalibrationFeatures
  derived: {
    /** f0로 정규화한 밝기 후보. normalizedTilt 참고. */
    tiltNormalized: number | null
  }
  /** 이 축 값을 만든 사상 범위의 스냅샷. 보정 스크립트가 features에서 새 범위로 축을 다시 계산할 때 기준이 된다. */
  axisRanges: typeof AXIS_RANGES
}

/** 내보내기가 캡처에서 읽는 부분. 음성 Blob(`recording.blob`)은 타입에서부터 받지 않는다. */
export interface CalibrationCapture {
  script: Pick<Script, 'id' | 'locale'>
  recording: Pick<Recording, 'durationMs'>
}

/**
 * f0로 정규화한 밝기 후보: tiltMedian / (2π·f0Median / sampleRate).
 * spectralTilt(차분 RMS / RMS)는 순음에서 2π·f/fs에 비례하므로(dsp.ts) 이 값은 순음 ≈ 1, 배음이 많을수록 커진다.
 * 지금의 brightness 축은 정규화하지 않은 tiltMedian을 쓰며, 이 값은 보정 때 대체 지표로 비교하려고 함께 모은다.
 * 유성 프레임이 없어 f0가 0이면 정의되지 않으므로 null.
 */
export function normalizedTilt(features: Pick<VoiceFeatures, 'tiltMedian' | 'f0Median' | 'sampleRate'>): number | null {
  if (!(features.f0Median > 0) || !(features.sampleRate > 0)) return null
  return features.tiltMedian / ((2 * Math.PI * features.f0Median) / features.sampleRate)
}

/**
 * 프로필과 캡처(글 id·언어·길이)에서 내보내기 레코드를 만든다. 순수 함수이며 음성에는 손대지 않는다.
 * fallbackLocale은 캡처가 없을 때(정상 흐름에서는 생기지 않는다)만 쓰는 화면 언어다.
 */
export function buildCalibrationExport(profile: VoiceProfile, capture: CalibrationCapture | null, fallbackLocale: Locale): CalibrationExport {
  const f = profile.features
  // 특징은 허용 목록으로 하나씩 옮긴다(구조 분해 금지). VoiceFeatures에 필드가 늘면 CalibrationFeatures 타입이 그 필드를 요구해
  // 컴파일이 실패하므로, 새 필드가 음성·시계열이 아닌지 확인하고 schemaVersion을 올린 뒤 여기와 테스트 목록에 더하거나 타입에서 제외해야 한다.
  const features: CalibrationFeatures = {
    durationSec: f.durationSec,
    sampleRate: f.sampleRate,
    frameCount: f.frameCount,
    energeticFrameCount: f.energeticFrameCount,
    voicedFrameCount: f.voicedFrameCount,
    speechRatio: f.speechRatio,
    f0Median: f.f0Median,
    f0Variation: f.f0Variation,
    f0Low: f.f0Low,
    f0High: f.f0High,
    rmsMean: f.rmsMean,
    rmsVariation: f.rmsVariation,
    zcrMean: f.zcrMean,
    tiltMedian: f.tiltMedian,
    syllableRate: f.syllableRate,
    pauseCount: f.pauseCount,
    envelopeLength: f.envelope.length,
  }
  const { warmth, density, pace, variation, pitch, brightness } = profile.axes
  return {
    schema: CALIBRATION_SCHEMA,
    schemaVersion: CALIBRATION_SCHEMA_VERSION,
    analysisVersion: ANALYSIS_VERSION,
    locale: capture?.script.locale ?? fallbackLocale,
    scriptId: capture?.script.id ?? null,
    durationMs: capture?.recording.durationMs ?? Math.round(f.durationSec * 1000),
    quality: profile.quality,
    typeCode: profile.typeCode,
    seed: profile.seed,
    axes: { warmth, density, pace, variation, pitch, brightness },
    features,
    derived: { tiltNormalized: normalizedTilt(f) },
    // 전역 상수를 그대로 참조하지 않고 복사해, 레코드를 받은 쪽이 바꿔도 축 계산에 영향이 없게 한다.
    axisRanges: structuredClone(AXIS_RANGES),
  }
}

/** 예: vocatype-calib-ko-WFME-2893421043.json — 언어별 보정이라 locale을 이름에 넣는다. 시각·이름은 넣지 않는다. */
export function calibrationFilename(record: Pick<CalibrationExport, 'locale' | 'typeCode' | 'seed'>, serviceName: string = SERVICE_NAME): string {
  return `${serviceName.toLowerCase()}-calib-${record.locale}-${record.typeCode}-${record.seed}.json`
}

/** 사람이 읽을 수 있게 2칸 들여쓰기, 끝에 줄바꿈 하나. */
export function serializeCalibration(record: CalibrationExport): string {
  return `${JSON.stringify(record, null, 2)}\n`
}

export function calibrationBlob(record: CalibrationExport): Blob {
  return new Blob([serializeCalibration(record)], { type: 'application/json' })
}

/** `?calibrate=1`일 때만 참. 값은 매번 URL에서 읽고 어디에도 저장하지 않는다. */
export function isCalibrationEnabled(search: string): boolean {
  return new URLSearchParams(search).get(CALIBRATION_QUERY_KEY) === '1'
}
