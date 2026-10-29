import { signatureInkFor } from '../features/signature/contrast'
import { SoundSignature } from './SoundSignature'

interface Props {
  /** 생성된 초상 이미지(data URL). 없으면 자리표시 초상을 그린다. */
  image: string | null
  palette: readonly string[]
  signature: readonly number[]
  alt: string
  /** 생성된 초상 모서리에 붙이는 작은 표시(예: "AI"). 자리표시 초상에는 붙이지 않는다(034). */
  badge?: string
}

export function PortraitFrame({ image, palette, signature, alt, badge }: Props) {
  if (image) {
    return (
      <div className="portrait">
        <img className="portrait__image" src={image} alt={alt} />
        {badge ? <span className="portrait__badge">{badge}</span> : null}
      </div>
    )
  }
  const [c1 = '#6d5dfc', c2 = '#ff7a59'] = palette
  return (
    <div className="portrait portrait--placeholder" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }} role="img" aria-label={alt}>
      {/* 컨테이너가 role="img"라 안쪽 SVG는 보조기기에 노출되지 않는다. 장식으로 숨긴다. */}
      <SoundSignature values={signature} size={240} color={signatureInkFor(c1, c2)} decorative className="portrait__signature" />
    </div>
  )
}
