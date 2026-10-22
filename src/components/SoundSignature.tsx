import { signatureBars } from '../features/signature/signature'

interface Props {
  values: readonly number[]
  /** 한 변의 길이(px). */
  size?: number
  /** 막대 색. 기본은 강조색. */
  color?: string
  /** 막대마다의 색(퍼스널 컬러 톤, signatureColors). 주면 color 대신 쓰고 안쪽 원은 그리지 않는다. */
  colors?: readonly string[]
  /** 접근성 이름. decorative가 아니면 필수. */
  title?: string
  /** 장식용이면 보조기기에서 숨긴다. */
  decorative?: boolean
  className?: string
}

/** 녹음 에너지 포락선을 원형 막대로 그린 사운드 시그니처. */
export function SoundSignature({ values, size = 220, color = 'var(--accent)', colors, title, decorative = false, className }: Props) {
  const bars = signatureBars(values, 100, 100, 44, 96)
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img' as const, 'aria-label': title }
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 200 200" focusable="false" {...a11y}>
      {colors && colors.length > 0 ? null : <circle cx="100" cy="100" r="38" fill="none" stroke={color} strokeOpacity="0.4" strokeWidth="1.5" />}
      <g stroke={color} strokeWidth="1.6" strokeLinecap="round">
        {bars.map((bar, i) => (
          <line key={i} x1={bar.x1} y1={bar.y1} x2={bar.x2} y2={bar.y2} stroke={colors?.[i]} />
        ))}
      </g>
    </svg>
  )
}
