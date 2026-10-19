interface Props {
  /** 한 변의 길이(px). */
  size?: number
  className?: string
}

/** 서비스 로고 마크. 파형 다섯 줄을 그라디언트 사각형 위에 올린 형태. */
export function Logo({ size = 40, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-a)" />
          <stop offset="1" stopColor="var(--brand-b)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#logo-gradient)" />
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
