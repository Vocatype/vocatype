import { describe, expect, it } from 'vitest'
import { getVoiceType } from '../../shared/catalog.ts'
import { ALL_TYPE_CODES } from '../../shared/typeCode.ts'
import { buildPortraitPrompt, MOOD_AXES, MOOD_VALUES_SCOPE, NOTHING_INDICATES_IDENTITY, pickFor, STAGING, TITLE_ONLY_MOOD } from './portraitPrompt.ts'

const axes = { warmth: 0.82, density: 0.71, pace: 0.77, variation: 0.68, pitch: 0.38, brightness: 0.45 }

/** 성별·나이·인종을 가리키는 말. 연출 후보·타입 이름·지시문 어디에도 없어야 한다(지시문의 "gender, age or ethnicity" 는 금지 지시라 제외). */
const BANNED =
  /\b(wo)?m[ae]n\b|\b(fe)?male\b|\bgirl\b|\bboy\b|\blady\b|\bgentleman\b|\bchild\b|\bteen(ager)?\b|\byoung\b|\bold\b|\belderly\b|\basian\b|\bcaucasian\b|\bafrican\b|\blatin[oa]?\b|\bblack\b|\bwhite\b|\bbeard\b|\bmakeup\b/i

describe('buildPortraitPrompt', () => {
  it('같은 입력이면 같은 문장이다(같은 녹음이면 같은 연출)', () => {
    expect(buildPortraitPrompt({ typeCode: 'WFQV', axes, seed: 42 })).toBe(buildPortraitPrompt({ typeCode: 'WFQV', axes, seed: 42 }))
  })

  it('같은 타입·같은 축이어도 씨앗이 다르면 연출이 갈리고, 모든 후보가 쓰인다(035)', () => {
    const prompts = new Set<string>()
    const seen = Object.fromEntries(Object.keys(STAGING).map((key) => [key, new Set<string>()])) as Record<keyof typeof STAGING, Set<string>>
    for (let seed = 0; seed < 2000; seed += 1) {
      const prompt = buildPortraitPrompt({ typeCode: 'WFQV', axes, seed: (seed * 2654435761) >>> 0 })
      prompts.add(prompt)
      for (const [key, options] of Object.entries(STAGING) as [keyof typeof STAGING, readonly string[]][]) {
        for (const option of options) if (option && prompt.includes(option)) seen[key].add(option)
      }
    }
    expect(prompts.size).toBeGreaterThan(1000)
    for (const [key, options] of Object.entries(STAGING) as [keyof typeof STAGING, readonly string[]][]) {
      expect(seen[key].size, key).toBe(options.filter(Boolean).length)
    }
  })

  it('다섯 축을 그림 의미로 0~1 값과 0·1의 뜻과 함께 넣고, 음높이는 넣지 않는다', () => {
    const prompt = buildPortraitPrompt({ typeCode: 'WFQV', axes, seed: 1 })
    expect(MOOD_AXES).toHaveLength(5)
    expect(prompt).toContain('- lighting warmth: 0.82 (0 = cool bluish daylight, 1 = deep golden light)')
    expect(prompt).toContain('- color richness: 0.71 (0 = pale, airy colors, 1 = deep, saturated colors)')
    expect(prompt).toContain('- sense of motion: 0.77 (0 = perfectly still pose, 1 = caught mid-movement)')
    expect(prompt).toContain('- expression liveliness: 0.68 (0 = calm, serene expression, 1 = animated expression, mid-laugh)')
    expect(prompt).toContain('- overall brightness: 0.45 (0 = dark, low-key image, 1 = bright, high-key image)')
    expect(prompt).not.toMatch(/pitch|0\.38/i)
    expect(prompt).toContain(`Mood values from 0 to 1. ${MOOD_VALUES_SCOPE}:`)
    // 다섯 축 가운데 둘은 자세·표정이라 범위에 넣는다(1차 리뷰 #4).
    expect(MOOD_VALUES_SCOPE).toContain('light, color, pose and expression')
    // 0과 1도 두 자리로 쓴다.
    expect(buildPortraitPrompt({ typeCode: 'WFQV', axes: { ...axes, warmth: 0, brightness: 1 }, seed: 1 })).toMatch(/lighting warmth: 0\.00[\s\S]*overall brightness: 1\.00/)
  })

  it('타입 영어 이름을 따옴표 없이 분위기로만 넣고, 사람의 직업·나이·외모가 아니라고 적고, 그림에 글자를 넣지 말라고 적는다. 타입 코드·씨앗 숫자는 넣지 않는다', () => {
    const seed = 2837461920
    const prompt = buildPortraitPrompt({ typeCode: 'WFQV', axes, seed })
    const name = getVoiceType('WFQV').name.en
    expect(prompt).toContain(`inspired by the mood of ${name}. ${TITLE_ONLY_MOOD}`)
    expect(prompt).not.toContain(`"${name}"`)
    expect(prompt).toContain('do not show any text, letters or logos in the image')
    // 성별·나이·인종 금지는 축 값뿐 아니라 문장 전체에 건다(1차 리뷰 #1).
    expect(prompt).toContain(NOTHING_INDICATES_IDENTITY)
    expect(prompt.indexOf(NOTHING_INDICATES_IDENTITY)).toBeGreaterThan(prompt.indexOf('overall brightness'))
    // 상수가 들어 있는지만이 아니라 무엇을 말하는지도 고정한다(2차 리뷰 #10).
    expect(TITLE_ONLY_MOOD).toContain("not the person's job, age or appearance")
    expect(MOOD_VALUES_SCOPE).toContain("never to decide the person's gender, age or ethnicity")
    expect(NOTHING_INDICATES_IDENTITY).toBe("Nothing above indicates the person's gender, age or ethnicity.")
    expect(prompt).not.toContain('WFQV')
    expect(prompt).not.toContain(String(seed))
  })

  it('모든 타입·여러 씨앗에서 성별·나이·인종을 가리키는 말이 없고, 실사이며, 색 코드 대신 색 이름을 쓴다', () => {
    for (const code of ALL_TYPE_CODES) {
      for (let seed = 0; seed < 300; seed += 7) {
        const prompt = buildPortraitPrompt({ typeCode: code, axes, seed })
        const withoutInstruction = [TITLE_ONLY_MOOD, MOOD_VALUES_SCOPE, NOTHING_INDICATES_IDENTITY].reduce((text, instruction) => text.replace(instruction, ''), prompt)
        expect(withoutInstruction, `${code} ${seed}`).not.toMatch(BANNED)
        expect(withoutInstruction, `${code} ${seed}`).not.toMatch(/gender|ethnicity|\bage\b/i)
        expect(prompt.toLowerCase()).toContain('photorealistic')
        expect(prompt).not.toMatch(/#[0-9a-f]{6}/i)
      }
    }
  })
})

describe('pickFor', () => {
  it('항목 번호마다 다르게 섞어 고른다(같은 씨앗이라도 항목끼리 짝지어 움직이지 않는다)', () => {
    const list = [0, 1, 2, 3]
    let same = 0
    for (let seed = 0; seed < 1000; seed += 1) if (pickFor(list, seed, 0) === pickFor(list, seed, 1)) same += 1
    // 서로 독립이면 약 1/4 이 우연히 같다.
    expect(same).toBeGreaterThan(150)
    expect(same).toBeLessThan(350)
    expect(pickFor(list, 7, 3)).toBe(pickFor(list, 7, 3))
  })
})
