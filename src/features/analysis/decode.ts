import { ANALYSIS_SAMPLE_RATE } from './features'
import { downmixToMono } from './dsp'

export interface DecodedAudio {
  samples: Float32Array
  sampleRate: number
}

/**
 * 녹음 Blob을 PCM으로 디코딩한다. 브라우저에서만 동작한다.
 * 분석 샘플레이트(16kHz)의 OfflineAudioContext로 디코딩하면 브라우저의 고품질 리샘플러가 바로 16kHz를
 * 만들어 주므로 우리 쪽 상자 필터 리샘플은 쓰이지 않는다. 그 샘플레이트를 거부하는 브라우저는 44.1kHz로 폴백한다.
 */
export async function decodeRecording(blob: Blob): Promise<DecodedAudio> {
  const bytes = await blob.arrayBuffer()
  let context: OfflineAudioContext
  try {
    context = new OfflineAudioContext(1, 1, ANALYSIS_SAMPLE_RATE)
  } catch {
    context = new OfflineAudioContext(1, 1, 44100)
  }
  const audio = await context.decodeAudioData(bytes)
  const channels: Float32Array[] = []
  for (let i = 0; i < audio.numberOfChannels; i += 1) channels.push(audio.getChannelData(i))
  return { samples: downmixToMono(channels), sampleRate: audio.sampleRate }
}
