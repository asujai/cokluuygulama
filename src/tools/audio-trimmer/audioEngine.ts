import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import {
  AudioMetadata,
  ProcessedAudioResult,
  SampleAudioItem,
  TrimConfig,
} from './types';

let audioContextInstance: any = null;

export function getAudioContext(): any {
  if (typeof window !== 'undefined') {
    const AudioContextClass =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      if (!audioContextInstance) {
        audioContextInstance = new AudioContextClass();
      }
      if (audioContextInstance.state === 'suspended') {
        audioContextInstance.resume().catch(() => {});
      }
      return audioContextInstance;
    }
  }
  return null;
}

export const SAMPLE_AUDIO_PRESETS: SampleAudioItem[] = [
  {
    id: 'sample_melody',
    name: 'Modern Akor Melodisi (Zil Sesi)',
    subtitle: '15 saniyelik melodik marimba & synth arpej',
    durationSec: 15,
    presetType: 'ringtone',
  },
  {
    id: 'sample_alarm',
    name: 'Enerjik Sabah Alarmı',
    subtitle: '12 saniyelik kademeli yükselen ritmik ton',
    durationSec: 12,
    presetType: 'alarm',
  },
  {
    id: 'sample_chime',
    name: 'Zarif Bildirim Tınısı',
    subtitle: '6 saniyelik çift vuruşlu kristal çan',
    durationSec: 6,
    presetType: 'notification',
  },
];

/**
 * Procedurally generates a sample AudioBuffer for zero-setup demo.
 */
export function generateProceduralSampleAudio(sampleId: string): {
  audioBuffer: AudioBuffer;
  metadata: AudioMetadata;
  peaks: number[];
} {
  const ctx = getAudioContext();
  const sampleRate = ctx?.sampleRate || 44100;

  if (sampleId === 'sample_alarm') {
    const duration = 12;
    const length = Math.round(sampleRate * duration);
    const buffer = ctx ? ctx.createBuffer(2, length, sampleRate) : createMockAudioBuffer(length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0);

    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const beat = (t % 1.5) / 1.5;
      const noteIdx = Math.floor(t / 1.5) % notes.length;
      const freq = notes[noteIdx];
      const env = Math.max(0, 1 - (beat * 2) % 1);
      const val = Math.sin(2 * Math.PI * freq * t) * env * 0.45;
      left[i] = val;
      right[i] = val;
    }

    const peaks = calculateWaveformPeaks(buffer, 80);
    return {
      audioBuffer: buffer,
      metadata: {
        name: 'Enerjik_Sabah_Alarmi.wav',
        duration,
        sampleRate,
        channels: buffer.numberOfChannels,
        size: length * 2 * 2 + 44,
        mimeType: 'audio/wav',
      },
      peaks,
    };
  } else if (sampleId === 'sample_chime') {
    const duration = 6;
    const length = Math.round(sampleRate * duration);
    const buffer = ctx ? ctx.createBuffer(2, length, sampleRate) : createMockAudioBuffer(length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let val = 0;
      if (t < 2.5) {
        val += Math.sin(2 * Math.PI * 1046.5 * t) * Math.exp(-t * 3) * 0.4; // C6
      }
      if (t >= 0.25 && t < 3.0) {
        const t2 = t - 0.25;
        val += Math.sin(2 * Math.PI * 1318.5 * t2) * Math.exp(-t2 * 2.5) * 0.45; // E6
      }
      left[i] = val;
      right[i] = val;
    }

    const peaks = calculateWaveformPeaks(buffer, 80);
    return {
      audioBuffer: buffer,
      metadata: {
        name: 'Zarif_Bildirim_Tinisi.wav',
        duration,
        sampleRate,
        channels: buffer.numberOfChannels,
        size: length * 2 * 2 + 44,
        mimeType: 'audio/wav',
      },
      peaks,
    };
  } else {
    // Default Melody (15s)
    const duration = 15;
    const length = Math.round(sampleRate * duration);
    const buffer = ctx ? ctx.createBuffer(2, length, sampleRate) : createMockAudioBuffer(length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0);

    const arpeggio = [523.25, 659.25, 783.99, 1046.5, 987.77, 783.99, 659.25, 587.33]; // C5, E5, G5, C6, B5, G5, E5, D5
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const noteIdx = Math.floor(t * 4) % arpeggio.length;
      const noteTime = (t * 4) % 1;
      const freq = arpeggio[noteIdx];
      const env = Math.exp(-noteTime * 5);
      const val = (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(2 * Math.PI * freq * 2 * t)) * env * 0.4;
      left[i] = val;
      right[i] = val;
    }

    const peaks = calculateWaveformPeaks(buffer, 80);
    return {
      audioBuffer: buffer,
      metadata: {
        name: 'Modern_Melodi_Zil_Sesi.wav',
        duration,
        sampleRate,
        channels: buffer.numberOfChannels,
        size: length * 2 * 2 + 44,
        mimeType: 'audio/wav',
      },
      peaks,
    };
  }
}

/**
 * Creates a mock AudioBuffer fallback for non-DOM environments if needed.
 */
function createMockAudioBuffer(length: number, sampleRate: number): AudioBuffer {
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  return {
    length,
    duration: length / sampleRate,
    sampleRate,
    numberOfChannels: 2,
    getChannelData: (ch: number) => (ch === 0 ? left : right),
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer;
}

/**
 * Decodes audio from an audio or video file URI using Web Audio decodeAudioData.
 */
export async function decodeAudioFromUri(
  uri: string,
  fileName: string = 'audio_file'
): Promise<{ audioBuffer: AudioBuffer; metadata: AudioMetadata; peaks: number[] }> {
  const ctx = getAudioContext();
  if (!ctx) {
    throw new Error('Web Audio Context kullanılamıyor.');
  }

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer: AudioBuffer = await ctx.decodeAudioData(arrayBuffer);

  const peaks = calculateWaveformPeaks(audioBuffer, 80);
  const metadata: AudioMetadata = {
    name: fileName,
    duration: Math.round(audioBuffer.duration * 100) / 100,
    sampleRate: audioBuffer.sampleRate,
    channels: audioBuffer.numberOfChannels,
    size: arrayBuffer.byteLength,
  };

  return { audioBuffer, metadata, peaks };
}

/**
 * Calculates normalized waveform peaks (0.0 to 1.0) for visual rendering.
 */
export function calculateWaveformPeaks(buffer: AudioBuffer, numBars: number = 80): number[] {
  const channelData = buffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / numBars);
  const peaks: number[] = [];

  for (let i = 0; i < numBars; i++) {
    const start = i * blockSize;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      const val = Math.abs(channelData[start + j] || 0);
      sum += val * val;
    }
    const rms = Math.sqrt(sum / blockSize);
    peaks.push(Math.min(1.0, Math.max(0.08, rms * 2.8)));
  }

  return peaks;
}

/**
 * Cuts/Trims the AudioBuffer according to Start & End times and applies Gain + Fade-in & Fade-out.
 */
export function processTrimmedAudio(
  source: AudioBuffer,
  config: TrimConfig
): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = source.sampleRate;
  const numChannels = source.numberOfChannels;

  const startSample = Math.max(0, Math.floor(config.startTime * sampleRate));
  const endSample = Math.min(source.length, Math.floor(config.endTime * sampleRate));
  const trimLength = Math.max(1, endSample - startSample);

  const resultBuffer = ctx
    ? ctx.createBuffer(numChannels, trimLength, sampleRate)
    : createMockAudioBuffer(trimLength, sampleRate);

  const fadeInSamples = Math.floor(config.fadeInSec * sampleRate);
  const fadeOutSamples = Math.floor(config.fadeOutSec * sampleRate);
  const gain = config.gain || 1.0;

  for (let ch = 0; ch < numChannels; ch++) {
    const srcData = source.getChannelData(ch);
    const destData = resultBuffer.getChannelData(ch);

    for (let i = 0; i < trimLength; i++) {
      let sample = srcData[startSample + i] * gain;

      // Apply Fade-In
      if (fadeInSamples > 0 && i < fadeInSamples) {
        sample *= i / fadeInSamples;
      }

      // Apply Fade-Out
      if (fadeOutSamples > 0 && i >= trimLength - fadeOutSamples) {
        const remaining = trimLength - i;
        sample *= Math.max(0, remaining / fadeOutSamples);
      }

      // Hard limiting to prevent clipping
      destData[i] = Math.max(-1.0, Math.min(1.0, sample));
    }
  }

  return resultBuffer;
}

/**
 * Encodes an AudioBuffer into standard 16-bit PCM RIFF WAV format.
 */
export function encodeAudioBufferToWav(buffer: AudioBuffer): {
  uri: string;
  size: number;
} {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = buffer.length;
  const dataByteLength = numSamples * blockAlign;
  const headerByteLength = 44;
  const totalLength = headerByteLength + dataByteLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + dataByteLength, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (PCM = 1)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate
  view.setUint32(28, sampleRate * blockAlign, true);
  // block align
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataByteLength, true);

  // Interleave channels & write 16-bit PCM samples
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  // Convert ArrayBuffer to Base64 data URI
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB chunking to avoid callstack overflow
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  const base64 = typeof btoa !== 'undefined' ? btoa(binary) : '';
  const uri = `data:audio/wav;base64,${base64}`;

  return { uri, size: totalLength };
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Region Audio Player for live preview and looping.
 */
export class RegionAudioPlayer {
  private ctx: any = null;
  private currentSource: any = null;
  private isPlayingNow: boolean = false;
  private startCtxTime: number = 0;
  private regionStart: number = 0;
  private regionEnd: number = 0;
  private isLooping: boolean = false;
  private animFrame: any = null;
  private onProgressCb: ((timeSec: number) => void) | null = null;
  private onEndedCb: (() => void) | null = null;

  constructor() {
    this.ctx = getAudioContext();
  }

  public play(
    buffer: AudioBuffer,
    startTime: number,
    endTime: number,
    loop: boolean,
    onProgress: (timeSec: number) => void,
    onEnded: () => void
  ) {
    this.stop();
    const ctx = getAudioContext();
    if (!ctx) return;

    this.regionStart = startTime;
    this.regionEnd = endTime;
    this.isLooping = loop;
    this.onProgressCb = onProgress;
    this.onEndedCb = onEnded;

    const duration = Math.max(0.1, endTime - startTime);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    if (loop) {
      source.loopStart = startTime;
      source.loopEnd = endTime;
    }

    source.connect(ctx.destination);
    source.start(0, startTime, loop ? undefined : duration);
    this.startCtxTime = ctx.currentTime;
    this.currentSource = source;
    this.isPlayingNow = true;

    source.onended = () => {
      if (!this.isLooping && this.isPlayingNow) {
        this.stop();
        if (this.onEndedCb) this.onEndedCb();
      }
    };

    // Track playhead position
    const updateProgress = () => {
      if (!this.isPlayingNow) return;
      const elapsed = ctx.currentTime - this.startCtxTime;
      const currentPos = loop
        ? this.regionStart + (elapsed % duration)
        : Math.min(this.regionEnd, this.regionStart + elapsed);

      if (this.onProgressCb) {
        this.onProgressCb(currentPos);
      }

      this.animFrame = requestAnimationFrame(updateProgress);
    };

    this.animFrame = requestAnimationFrame(updateProgress);
  }

  public stop() {
    this.isPlayingNow = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {}
      this.currentSource = null;
    }
  }

  public isPlaying(): boolean {
    return this.isPlayingNow;
  }
}

/**
 * Share or download exported ringtone / audio file.
 */
export async function shareProcessedAudio(
  result: ProcessedAudioResult
): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.href = result.uri;
    link.download = result.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(result.uri, {
      mimeType: 'audio/wav',
      dialogTitle: 'Zil Sesini / Kırpılan Sesi Paylaş',
    });
  } else {
    throw new Error('Cihazınızda paylaşım özelliği desteklenmiyor.');
  }
}
