import { downmixToMono } from './dsp'

export interface DecodedAudio {
  samples: Float32Array
  sampleRate: number
}

/**
 * 녹음 Blob을 PCM으로 디코딩한다. 브라우저에서만 동작한다.
 * OfflineAudioContext를 쓰면 자동재생 정책과 무관하고 close()가 필요 없다.
 */
export async function decodeRecording(blob: Blob): Promise<DecodedAudio> {
  const bytes = await blob.arrayBuffer()
  const context = new OfflineAudioContext(1, 1, 44100)
  const audio = await context.decodeAudioData(bytes)
  const channels: Float32Array[] = []
  for (let i = 0; i < audio.numberOfChannels; i += 1) channels.push(audio.getChannelData(i))
  return { samples: downmixToMono(channels), sampleRate: audio.sampleRate }
}
