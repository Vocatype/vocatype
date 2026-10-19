import { useContext, useEffect, useRef, type ReactNode } from 'react'
import { FlowContext } from '../app/FlowContext'

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
 * 마운트되면 스크롤을 맨 위로 올리고, 사용자가 화면을 옮긴 경우에만 제목에 초점을 줘
 * 보조기기에 화면 전환을 알린다. 첫 로드에서는 초점을 건드리지 않아 Tab 순서가 상단 바부터 시작한다.
 */
export function Screen({ title, lead, icon, centered = false, className, children }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { hasNavigated } = useContext(FlowContext)

  // 마운트 시 한 번만 실행하려는 effect다. hasNavigated는 flowReducer가 step과 함께만 바꾸므로
  // 값이 바뀌는 순간은 항상 이 컴포넌트가 새로 마운트되는 순간이다.
  useEffect(() => {
    window.scrollTo({ top: 0 })
    if (hasNavigated) headingRef.current?.focus({ preventScroll: true })
  }, [hasNavigated])

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
