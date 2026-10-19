import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  /** 제목 아래 한 줄 설명. */
  lead?: string
  /** 제목 위에 올리는 요소(로고 등). */
  icon?: ReactNode
  /** 세로 가운데 정렬. 내용이 적은 화면에 쓴다. */
  centered?: boolean
  className?: string
  children?: ReactNode
}

/**
 * 화면 공통 래퍼.
 * 마운트되면 스크롤을 맨 위로 올리고 제목에 초점을 옮겨 화면 전환을 보조기기에 알린다.
 */
export function Screen({ title, lead, icon, centered = false, className, children }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  const classes = ['screen', centered ? 'screen--centered' : '', className ?? ''].filter(Boolean).join(' ')

  return (
    <section className={classes}>
      <header className="screen__header">
        {icon ? <div className="screen__icon">{icon}</div> : null}
        <h1 ref={headingRef} tabIndex={-1} className="screen__title">
          {title}
        </h1>
        {lead ? <p className="screen__lead">{lead}</p> : null}
      </header>
      {children}
    </section>
  )
}
