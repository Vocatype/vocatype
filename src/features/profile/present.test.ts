import { describe, expect, it } from 'vitest'
import type { VoiceProfile } from './types'
import { presentResult } from './present'

const profile: VoiceProfile = {
  typeCode: 'WFQV',
  axes: { warmth: 0.8, density: 0.7, pace: 0.6, variation: 0.7, pitch: 0.2, brightness: 0.3 },
  features: {
    durationSec: 12.4,
    sampleRate: 16000,
    frameCount: 380,
    energeticFrameCount: 300,
    voicedFrameCount: 260,
    speechRatio: 0.85,
    f0Median: 142.4,
    f0Variation: 0.22,
    f0Low: 110,
    f0High: 180,
    rmsMean: 0.08,
    rmsVariation: 0.5,
    zcrMean: 0.05,
    tiltMedian: 0.12,
    syllableRate: 4.17,
    pauseCount: 2,
    envelope: [0.2, 0.9, 1, 0.4, 0.1, 0.6],
  },
  seed: 12345,
  quality: 'ok',
}

describe('presentResult', () => {
  it('로케일에 맞는 문구로 푼다', () => {
    const ko = presentResult(profile, null, 'ko')
    const en = presentResult(profile, null, 'en')
    expect(ko.name).toBe('불꽃 이야기꾼')
    expect(en.name).toBe('The Fireside Storyteller')
    expect(ko.axes.map((axis) => axis.label)).toEqual(['따뜻한', '꽉 찬', '빠른', '생동하는'])
    expect(en.color.name).toBe('Autumn Warm')
    expect(ko.scent.base[0]).toBe('앰버')
  })

  it('통계를 사람이 읽는 단위로 바꾼다', () => {
    const view = presentResult(profile, null, 'ko')
    expect(view.stats.pitchHz).toBe(142)
    expect(view.stats.syllablesPerMinute).toBe(250)
    expect(view.stats.durationMs).toBe(12400)
    expect(view.signature).toHaveLength(180)
  })

  it('녹음 정보가 있으면 제목과 길이를 그대로 쓴다', () => {
    const view = presentResult(
      profile,
      {
        script: { id: 'ko-seosi', locale: 'ko', title: '서시', author: '윤동주', year: '1941', excerpt: false, lines: ['a'] },
        recording: { blob: new Blob(), mimeType: 'audio/webm', durationMs: 9000 },
      },
      'ko',
    )
    expect(view.scriptTitle).toBe('서시')
    expect(view.stats.durationMs).toBe(9000)
  })
  it('축 강도는 타입 코드 순서로 결정된 쪽과 퍼센트를 준다', () => {
    const view = presentResult(profile, null, 'ko')
    expect(view.axes.map((axis) => axis.letter).join('')).toBe(view.code)
    expect(view.axes[0]).toMatchObject({ key: 'temperature', title: '온도', label: '따뜻한', otherLabel: '서늘한', percent: 80, boundary: false })
    expect(view.axes.every((axis) => axis.percent >= 50 && axis.percent <= 100)).toBe(true)
  })

  it('경계 축과 영어 라벨, 신호 부족 품질을 그대로 전달한다', () => {
    const boundary = presentResult({ ...profile, axes: { ...profile.axes, density: 0.52 } }, null, 'en')
    expect(boundary.axes[1]).toMatchObject({ letter: 'F', label: 'Full', otherLabel: 'Light', percent: 52, boundary: true })
    const low = presentResult({ ...profile, quality: 'low-signal' }, null, 'ko')
    expect(low.quality).toBe('low-signal')
  })
})
