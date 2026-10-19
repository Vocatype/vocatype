/**
 * 폭에 맞춰 줄을 나눈다. 공백 단위로 먼저 자르고, 한 단어가 폭을 넘으면 글자 단위로 자른다.
 * measure는 문자열의 렌더 폭을 돌려준다(캔버스 measureText 등). 캔버스 없이 테스트할 수 있게 주입한다.
 */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    let line = ''
    const pushWord = (word: string) => {
      const candidate = line ? `${line} ${word}` : word
      if (measure(candidate) <= maxWidth) {
        line = candidate
        return
      }
      if (line) lines.push(line)
      line = ''
      if (measure(word) <= maxWidth) {
        line = word
        return
      }
      // 한 단어가 폭을 넘으면 글자 단위
      for (const char of word) {
        const next = line + char
        if (measure(next) <= maxWidth || line === '') line = next
        else {
          lines.push(line)
          line = char
        }
      }
    }
    for (const word of words) pushWord(word)
    if (line) lines.push(line)
    if (words.length === 0) lines.push('')
  }
  return lines
}
