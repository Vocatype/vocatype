import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** 부모 너비를 가득 채운다. 모바일에서 주 동작 버튼에 쓴다. */
  block?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  type = 'button',
  ...rest
}: Props) {
  const classes = ['btn', `btn--${variant}`, `btn--${size}`, block ? 'btn--block' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={classes} {...rest} />
}
