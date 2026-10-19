import { signatureBars } from '../features/signature/signature'

interface Props {
  values: readonly number[]
  /** 한 변의 길이(px). */
  size?: number
  /** 막대 색. 기본은 강조색. */
  color?: string
  title: string
  className?: string
}

/** 녹음 에너지 포락선을 원형 막대로 그린 사운드 시그니처. */
export function SoundSignature({ values, size = 220, color = 'var(--accent)', title, className }: Props) {
  const bars = signatureBars(values, 100, 100, 44, 96)
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={title}>
      <circle cx="100" cy="100" r="38" fill="none" stroke={color} strokeOpacity="0.4" strokeWidth="1.5" />
      <g stroke={color} strokeWidth="1.6" strokeLinecap="round">
        {bars.map((bar, i) => (
          <line key={i} x1={bar.x1} y1={bar.y1} x2={bar.x2} y2={bar.y2} />
        ))}
      </g>
    </svg>
  )
}
