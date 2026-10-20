import { AXES, type AxisKey } from '../../../shared/catalog'
import type { Localized } from '../../../shared/catalog'
import type { VoiceAxes } from '../analysis/axes'

/** 표시 퍼센트가 이 값 미만이면 경계형(반대 성향도 있음)으로 본다. 표시값 기준이라 좌우가 대칭이다. */
export const BOUNDARY_PERCENT = 55

export interface AxisStrength {
  key: AxisKey
  title: Localized
  /** 결정된 쪽의 글자(W/C 등)와 라벨. */
  letter: string
  label: Localized
  /** 반대쪽 글자·라벨. 경계형 안내에 쓴다. */
  otherLetter: string
  otherLabel: Localized
  /** 결정된 쪽으로 기운 정도 0.5..1 → 50..100%. */
  percent: number
  /** percent < BOUNDARY_PERCENT 이면 참. */
  boundary: boolean
}

const AXIS_VALUE: Record<AxisKey, keyof VoiceAxes> = {
  temperature: 'warmth',
  texture: 'density',
  pace: 'pace',
  flow: 'variation',
}

/**
 * 6축 값에서 타입을 결정한 4축의 강도를 만든다.
 * 값 ≥ 0.5면 왼쪽(첫 글자) 쪽, 아니면 오른쪽. percent는 결정된 쪽으로 기운 비율(50~100).
 */
export function axisStrengths(axes: VoiceAxes): AxisStrength[] {
  return AXES.map((axis) => {
    const value = axes[AXIS_VALUE[axis.key]]
    const left = value >= 0.5
    const lean = left ? value : 1 - value
    const percent = Math.round(lean * 100)
    return {
      key: axis.key,
      title: axis.title,
      letter: axis.letters[left ? 0 : 1],
      label: axis.labels[left ? 0 : 1],
      otherLetter: axis.letters[left ? 1 : 0],
      otherLabel: axis.labels[left ? 1 : 0],
      percent,
      boundary: percent < BOUNDARY_PERCENT,
    }
  })
}
