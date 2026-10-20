import type { Locale } from '../../i18n/locales'
import type { Capture } from '../recorder/types'
import { resampleEnvelope } from '../signature/signature'
import { getCompatibility, getPersonalColor, getScent, getVoiceType, type Season } from '../../../shared/catalog'
import { axisStrengths } from './axisStrength'
import type { Localized, TypeCode, VoiceProfile } from './types'

/** 타입을 정한 한 축의 강도(현재 언어로 풀린 값). */
export interface AxisStrengthView {
  key: string
  title: string
  letter: string
  label: string
  otherLetter: string
  otherLabel: string
  /** 결정된 쪽으로 기운 정도 50..100 */
  percent: number
  /** 0.5 근처라 반대 성향도 있음 */
  boundary: boolean
}

/** 화면과 저장 이미지가 함께 쓰는, 문구가 현재 언어로 풀린 결과. */
export interface ResultView {
  code: TypeCode
  name: string
  description: string
  /** 타입을 정한 4축의 강도. 타입 코드 글자 순서. */
  axes: AxisStrengthView[]
  color: { season: Season; name: string; description: string; palette: readonly string[] }
  scent: { name: string; top: string[]; middle: string[]; base: string[]; mood: string }
  match: {
    best: { code: TypeCode; name: string }
    opposite: { code: TypeCode; name: string }
    bestReason: string
    oppositeReason: string
  }
  signature: number[]
  stats: { pitchHz: number; syllablesPerMinute: number; durationMs: number }
  scriptTitle: string
  quality: VoiceProfile['quality']
}

export function presentResult(profile: VoiceProfile, capture: Capture | null, locale: Locale): ResultView {
  const pick = (text: Localized) => text[locale]
  const type = getVoiceType(profile.typeCode)
  const color = getPersonalColor(profile.typeCode)
  const scent = getScent(profile.typeCode)
  const match = getCompatibility(profile.typeCode)

  return {
    code: profile.typeCode,
    name: pick(type.name),
    description: pick(type.description),
    axes: axisStrengths(profile.axes).map((axis) => ({
      key: axis.key,
      title: pick(axis.title),
      letter: axis.letter,
      label: pick(axis.label),
      otherLetter: axis.otherLetter,
      otherLabel: pick(axis.otherLabel),
      percent: axis.percent,
      boundary: axis.boundary,
    })),
    color: { season: color.season, name: pick(color.name), description: pick(color.description), palette: color.palette },
    scent: {
      name: pick(scent.name),
      top: scent.top.map(pick),
      middle: scent.middle.map(pick),
      base: scent.base.map(pick),
      mood: pick(scent.mood),
    },
    match: {
      best: { code: match.best.code, name: pick(match.best.name) },
      opposite: { code: match.opposite.code, name: pick(match.opposite.name) },
      bestReason: pick(match.bestReason),
      oppositeReason: pick(match.oppositeReason),
    },
    signature: resampleEnvelope(profile.features.envelope),
    stats: {
      pitchHz: Math.round(profile.features.f0Median),
      syllablesPerMinute: Math.round(profile.features.syllableRate * 60),
      durationMs: capture?.recording.durationMs ?? Math.round(profile.features.durationSec * 1000),
    },
    scriptTitle: capture?.script.title ?? '',
    quality: profile.quality,
  }
}
