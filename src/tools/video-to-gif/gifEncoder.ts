import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import {
  ConversionProgress,
  GifConversionOptions,
  GifResolution,
  GifResult,
  VideoInfo,
} from './types';

// ==========================================
// 1. Helpers & Resolution Map
// ==========================================

export const RESOLUTION_MAP: Record<GifResolution, { maxDim: number; label: string }> = {
  '240p': { maxDim: 320, label: '240p (Hafif / Hızlı)' },
  '360p': { maxDim: 480, label: '360p (Dengeli)' },
  '480p': { maxDim: 640, label: '480p (Yüksek Kalite)' },
};

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const index = Math.min(i, units.length - 1);
  const size = bytes / Math.pow(1024, index);
  return `${size.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

// ==========================================
// 2. Pure TS NeuQuant & GIF89a LZW Encoder
// ==========================================

class ByteArrayOutput {
  public data: number[] = [];

  writeByte(val: number) {
    this.data.push(val & 0xff);
  }

  writeBytes(arr: number[] | Uint8Array) {
    for (let i = 0; i < arr.length; i++) {
      this.data.push(arr[i] & 0xff);
    }
  }

  writeShort(val: number) {
    this.writeByte(val & 0xff);
    this.writeByte((val >> 8) & 0xff);
  }

  writeString(str: string) {
    for (let i = 0; i < str.length; i++) {
      this.writeByte(str.charCodeAt(i));
    }
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.data);
  }
}

/**
 * Fast median-cut / uniform color quantizer (256 colors)
 */
function quantizeRgba(rgba: Uint8ClampedArray): { palette: number[]; indexed: Uint8Array } {
  const pixelCount = rgba.length / 4;
  const indexed = new Uint8Array(pixelCount);

  // Sample unique colors
  const colorMap = new Map<number, number>();
  const palette: number[] = [];

  for (let i = 0; i < pixelCount; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];

    // Quantize 8-bit to 5-bit (32 levels per channel = 32768 colors)
    const qr = (r >> 3) << 3;
    const qg = (g >> 3) << 3;
    const qb = (b >> 3) << 3;
    const key = (qr << 16) | (qg << 8) | qb;

    let palIdx = colorMap.get(key);
    if (palIdx === undefined) {
      if (palette.length / 3 < 256) {
        palIdx = palette.length / 3;
        colorMap.set(key, palIdx);
        palette.push(qr, qg, qb);
      } else {
        // Find nearest existing in palette
        palIdx = findNearestColorIndex(qr, qg, qb, palette);
      }
    }
    indexed[i] = palIdx;
  }

  // Pad palette to 256 colors (768 bytes)
  while (palette.length < 768) {
    palette.push(0, 0, 0);
  }

  return { palette, indexed };
}

function findNearestColorIndex(r: number, g: number, b: number, palette: number[]): number {
  let minDiff = Infinity;
  let nearestIdx = 0;
  const numColors = palette.length / 3;

  for (let i = 0; i < numColors; i++) {
    const pr = palette[i * 3];
    const pg = palette[i * 3 + 1];
    const pb = palette[i * 3 + 2];
    const diff = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
    if (diff < minDiff) {
      minDiff = diff;
      nearestIdx = i;
      if (diff === 0) break;
    }
  }

  return nearestIdx;
}

/**
 * GIF LZW Image Compressor
 */
function lzwCompress(data: Uint8Array, minCodeSize: number, out: ByteArrayOutput) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  let codeSize = minCodeSize + 1;
  let maxCode = (1 << codeSize) - 1;
  let nextCode = eoiCode + 1;

  const dictionary = new Map<string, number>();

  const resetDict = () => {
    dictionary.clear();
    for (let i = 0; i < clearCode; i++) {
      dictionary.set(String(i), i);
    }
    codeSize = minCodeSize + 1;
    maxCode = (1 << codeSize) - 1;
    nextCode = eoiCode + 1;
  };

  resetDict();

  let curAccum = 0;
  let curBits = 0;
  const packet: number[] = [];

  const flushPacket = () => {
    if (packet.length > 0) {
      out.writeByte(packet.length);
      out.writeBytes(packet);
      packet.length = 0;
    }
  };

  const outputCode = (code: number) => {
    curAccum |= code << curBits;
    curBits += codeSize;

    while (curBits >= 8) {
      packet.push(curAccum & 0xff);
      if (packet.length === 254) {
        flushPacket();
      }
      curAccum >>= 8;
      curBits -= 8;
    }

    if (nextCode > maxCode) {
      if (codeSize < 12) {
        codeSize++;
        maxCode = (1 << codeSize) - 1;
      }
    }
  };

  out.writeByte(minCodeSize); // Initial code size
  outputCode(clearCode);

  let prefix = String(data[0]);

  for (let i = 1; i < data.length; i++) {
    const k = String(data[i]);
    const phrase = prefix + ',' + k;

    if (dictionary.has(phrase)) {
      prefix = phrase;
    } else {
      outputCode(dictionary.get(prefix)!);
      if (nextCode < 4096) {
        dictionary.set(phrase, nextCode++);
      } else {
        outputCode(clearCode);
        resetDict();
      }
      prefix = k;
    }
  }

  outputCode(dictionary.get(prefix)!);
  outputCode(eoiCode);

  // Flush remaining bits
  if (curBits > 0) {
    packet.push(curAccum & 0xff);
  }
  flushPacket();
  out.writeByte(0); // Block terminator
}

/**
 * Encode raw ImageData frames into a GIF binary Uint8Array
 */
export function encodeFramesToGif(
  frames: ImageData[],
  delayHundredths: number,
  loop: boolean = true
): Uint8Array {
  if (frames.length === 0) throw new Error('Dönüştürülecek kare bulunamadı.');

  const width = frames[0].width;
  const height = frames[0].height;
  const out = new ByteArrayOutput();

  // 1. Header GIF89a
  out.writeString('GIF89a');

  // 2. Logical Screen Descriptor
  out.writeShort(width);
  out.writeShort(height);
  out.writeByte(0x70); // No Global Color Table, 8 bits/pixel
  out.writeByte(0); // Background color index
  out.writeByte(0); // Pixel aspect ratio

  // 3. Netscape 2.0 Application Extension (for loop)
  if (loop) {
    out.writeByte(0x21); // Extension Introducer
    out.writeByte(0xff); // Application Extension
    out.writeByte(11); // Block size
    out.writeString('NETSCAPE2.0');
    out.writeByte(3); // Sub-block length
    out.writeByte(1); // Sub-block ID
    out.writeShort(0); // Loop count (0 = infinite)
    out.writeByte(0); // Block terminator
  }

  // 4. Encode each frame
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const { palette, indexed } = quantizeRgba(frame.data);

    // Graphic Control Extension
    out.writeByte(0x21); // Extension Introducer
    out.writeByte(0xf9); // Graphic Control Label
    out.writeByte(4); // Block size
    out.writeByte(0x04); // Disposal: Do not dispose, no transparency
    out.writeShort(delayHundredths); // Frame delay in 1/100 sec
    out.writeByte(0); // Transparent color index
    out.writeByte(0); // Block terminator

    // Image Descriptor
    out.writeByte(0x2c); // Image Separator
    out.writeShort(0); // Left
    out.writeShort(0); // Top
    out.writeShort(width); // Width
    out.writeShort(height); // Height
    out.writeByte(0x87); // Local Color Table Present, 256 colors (8 bits)

    // Local Color Table (768 bytes)
    out.writeBytes(palette);

    // Image Data (LZW)
    lzwCompress(indexed, 8, out);
  }

  // 5. Trailer
  out.writeByte(0x3b);

  return out.toUint8Array();
}

// ==========================================
// 3. Frame Extraction Engine
// ==========================================

export async function convertVideoToGif(
  videoUri: string,
  fileName: string,
  options: GifConversionOptions,
  onProgress?: (progress: ConversionProgress) => void
): Promise<GifResult> {
  if (typeof document === 'undefined') {
    throw new Error('Video dönüştürme web/tarayıcı motoru gerektirir.');
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUri;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = async () => {
      try {
        const origWidth = video.videoWidth || 640;
        const origHeight = video.videoHeight || 480;
        const videoDuration = video.duration || 5;

        const maxDim = RESOLUTION_MAP[options.resolution].maxDim;
        const aspect = origWidth / origHeight;
        let targetWidth = origWidth;
        let targetHeight = origHeight;

        if (origWidth >= origHeight) {
          targetWidth = Math.min(origWidth, maxDim);
          targetHeight = Math.round(targetWidth / aspect);
        } else {
          targetHeight = Math.min(origHeight, maxDim);
          targetWidth = Math.round(targetHeight * aspect);
        }

        // Ensure even dimensions
        targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
        targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;

        const start = Math.max(0, options.startTime);
        const end = Math.min(videoDuration, Math.max(start + 0.5, options.endTime));
        const duration = end - start;

        const fps = options.fps;
        const frameInterval = 1 / fps;
        const totalFrames = Math.max(2, Math.floor(duration * fps));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Canvas context unavailable');

        const frames: ImageData[] = [];

        for (let f = 0; f < totalFrames; f++) {
          const targetTime = start + f * frameInterval;
          await seekVideoToTime(video, targetTime);

          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          frames.push(imgData);

          if (onProgress) {
            onProgress({
              phase: 'extracting',
              percent: Math.round(((f + 1) / totalFrames) * 60),
              currentFrame: f + 1,
              totalFrames,
            });
          }
        }

        // Encode frames
        if (onProgress) {
          onProgress({
            phase: 'encoding',
            percent: 75,
            currentFrame: totalFrames,
            totalFrames,
          });
        }

        // Delay in 1/100s (e.g. 10 fps -> 10 hundredths of sec)
        const delayHundredths = Math.round(100 / fps);
        const gifBytes = encodeFramesToGif(frames, delayHundredths, options.loop);

        if (onProgress) {
          onProgress({
            phase: 'done',
            percent: 100,
            currentFrame: totalFrames,
            totalFrames,
          });
        }

        const blob = new Blob([gifBytes as unknown as BlobPart], { type: 'image/gif' });
        const gifUri = URL.createObjectURL(blob);

        const outName = `${fileName.replace(/\.[^.]+$/, '')}.gif`;

        resolve({
          uri: gifUri,
          fileName: outName,
          fileSize: gifBytes.length,
          width: targetWidth,
          height: targetHeight,
          duration,
          framesCount: totalFrames,
        });
      } catch (err) {
        reject(err);
      }
    };

    video.onerror = () => {
      reject(new Error('Video yüklenirken veya çözülürken bir hata oluştu.'));
    };

    video.load();
  });
}

function seekVideoToTime(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });
}

// ==========================================
// 4. Share / Download GIF
// ==========================================

export async function shareOrDownloadGif(gifUri: string, fileName: string): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.href = gifUri;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(gifUri, {
      mimeType: 'image/gif',
      dialogTitle: 'GIF Animasyonunu Paylaş',
    });
  } else {
    throw new Error('Paylaşım özelliği bu cihazda desteklenmiyor.');
  }
}
