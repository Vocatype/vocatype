import { describe, expect, it } from 'vitest'
import { PORTRAIT_CLIENT_TIMEOUT_MS, PORTRAIT_SERVER_TIMEOUT_MS, READING_CHAIN_BUDGET_MS, READING_CLIENT_TIMEOUT_MS } from './api.ts'

describe('리딩 시간 규칙', () => {
  it('클라이언트 대기 시간이 Worker 체인 예산보다 길다(클라이언트가 포기한 뒤 Worker 가 제공자를 새로 부르지 않게)', () => {
    expect(READING_CLIENT_TIMEOUT_MS).toBeGreaterThan(READING_CHAIN_BUDGET_MS)
  })
})

describe('초상 시간 규칙', () => {
  it('클라이언트 대기 시간이 Worker 초상 호출 상한보다 길다(상한에 걸린 Worker 의 503 을 클라이언트가 받게)', () => {
    expect(PORTRAIT_CLIENT_TIMEOUT_MS).toBeGreaterThan(PORTRAIT_SERVER_TIMEOUT_MS)
  })
})
