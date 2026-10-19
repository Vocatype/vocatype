export type SaveOutcome = 'downloaded' | 'shared' | 'cancelled'

export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' })] })
  } catch {
    return false
  }
}

/** 파일을 내려받는다. 브라우저가 새 탭으로 열더라도 사용자는 거기서 저장할 수 있다. */
export function downloadBlob(blob: Blob, filename: string): SaveOutcome {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

/** OS 공유 시트로 보낸다. 사용자가 닫으면 'cancelled'. */
export async function shareBlob(blob: Blob, filename: string, title: string): Promise<SaveOutcome> {
  const file = new File([blob], filename, { type: 'image/png' })
  try {
    await navigator.share({ files: [file], title })
    return 'shared'
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'cancelled'
    throw error
  }
}
