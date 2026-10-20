/**
 * 분석 규칙의 판. 특징 추출(`features.ts`)의 계산이나 축 사상 범위(`axes.ts`의 `AXIS_RANGES`)가 바뀌어
 * 같은 녹음에서 다른 수치가 나오게 되면 올린다. 보정용 내보내기 JSON의 `analysisVersion`에 들어가,
 * 모인 파일 중 어느 규칙으로 나온 수치인지 가려내는 데 쓴다.
 */
export const ANALYSIS_VERSION = 1
