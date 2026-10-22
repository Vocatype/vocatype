import { describe, expect, it } from 'vitest'
import { AXES, getCompatibility, getPersonalColor, getScent, getVoiceType } from '../../../shared/catalog'
import { ALL_TYPE_CODES } from '../../../shared/typeCode'
import { en } from './en'
import { ko } from './ko'

/** 문자열 값을 모두 꺼낸다(카탈로그는 언어별 객체·배열이 섞여 있다). */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}

describe('messages', () => {
  it('영어 사전은 한국어 사전과 같은 키 집합을 가진다', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ko).sort())
  })

  it('화면 문구는 녹음을 사람을 알아보는 생체 정보처럼 말하지 않고(지문·fingerprint·voiceprint), "당신"을 쓰지 않는다', () => {
    // 화면에 나오는 글: 문구 사전과 카탈로그(축·타입·퍼스널 컬러·향·궁합). 해설 본문은 AI가 만들고 해설 프롬프트가 규칙을 건다(030).
    const catalog = [AXES, ALL_TYPE_CODES.map((code) => [getVoiceType(code), getPersonalColor(code), getScent(code), getCompatibility(code)])]
    const texts = [...Object.values(ko), ...Object.values(en), ...strings(catalog)]
    expect(texts.length).toBeGreaterThan(Object.keys(ko).length * 2)
    expect(texts.filter((text) => /지문|fingerprint|voiceprint|당신/i.test(text))).toEqual([])
  })

  it('빈 메시지가 없다', () => {
    for (const dictionary of [ko, en]) {
      for (const [key, value] of Object.entries(dictionary)) {
        expect(value.trim().length, `${key} is empty`).toBeGreaterThan(0)
      }
    }
  })
})
