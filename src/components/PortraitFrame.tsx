import { SoundSignature } from './SoundSignature'

interface Props {
  /** 생성된 초상 이미지(data URL). 없으면 자리표시 초상을 그린다. */
  image: string | null
  palette: readonly string[]
  signature: readonly number[]
  alt: string
  signatureTitle: string
}

export function PortraitFrame({ image, palette, signature, alt, signatureTitle }: Props) {
  if (image) {
    return (
      <div className="portrait">
        <img className="portrait__image" src={image} alt={alt} />
      </div>
    )
  }
  const [c1 = '#6d5dfc', c2 = '#ff7a59'] = palette
  return (
    <div className="portrait portrait--placeholder" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }} role="img" aria-label={alt}>
      <SoundSignature values={signature} size={240} color="rgba(255,255,255,0.9)" title={signatureTitle} className="portrait__signature" />
    </div>
  )
}
