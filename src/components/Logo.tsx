import { useId } from 'react'

interface Props {
  /** 한 변의 길이(px). */
  size?: number
  className?: string
}

/** 서비스 로고 마크. 장식용이며 이름은 항상 텍스트로 함께 표시한다. */
export function Logo({ size = 40, className }: Props) {
  // 같은 페이지에 로고가 여러 개 있어도 그라디언트 id가 겹치지 않게 한다.
  const gradientId = useId()

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-a)" />
          <stop offset="1" stopColor="var(--brand-b)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      <g fill="#fff" fillOpacity="0.95">
        <rect x="14" y="26" width="5" height="12" rx="2.5" />
        <rect x="23" y="18" width="5" height="28" rx="2.5" />
        <rect x="32" y="12" width="5" height="40" rx="2.5" />
        <rect x="41" y="20" width="5" height="24" rx="2.5" />
        <rect x="50" y="28" width="5" height="8" rx="2.5" />
      </g>
    </svg>
  )
}
