import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import {
  VideoMetadata,
  VideoEditOptions,
  ProcessResult,
  PlatformCapabilities,
  AspectRatioOption,
} from './types';

export function getPlatformCapabilities(): PlatformCapabilities {
  const isWeb = Platform.OS === 'web';
  if (isWeb) {
    return {
      isWeb: true,
      canReencodeVideo: true,
      canExtractAudio: true,
      canShare: true,
      note: 'Web Canvas ve MediaRecorder motoru ile canlı video düzenleme, döndürme, kırpma ve ses ayıklama aktif.',
    };
  }
  return {
    isWeb: false,
    canReencodeVideo: false,
    canExtractAudio: true,
    canShare: true,
    note: 'Mobil cihazda canlı video önizleme, kırpma, döndürme ve ses kısma parametreleri aktiftir. Tam kare re-encoding Web/Canvas çalışma zamanında çalışır.',
  };
}

export function formatSeconds(sec: number): string {
  if (isNaN(sec) || sec < 0) return '00:00';
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  const padMins = mins.toString().padStart(2, '0');
  const padSecs = secs.toString().padStart(2, '0');
  return `${padMins}:${padSecs}.${ms}`;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return 'Bilinmiyor';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function calculateCropDimensions(
  origW: number,
  origH: number,
  cropAspect: AspectRatioOption,
  rotation: number
): { width: number; height: number; sx: number; sy: number; sw: number; sh: number } {
  // If rotated 90 or 270 degrees, effective width and height swap for rendering
  const effW = rotation === 90 || rotation === 270 ? origH : origW;
  const effH = rotation === 90 || rotation === 270 ? origW : origH;

  let targetRatio = effW / effH;
  if (cropAspect === '1:1') targetRatio = 1;
  else if (cropAspect === '16:9') targetRatio = 16 / 9;
  else if (cropAspect === '9:16') targetRatio = 9 / 16;
  else if (cropAspect === '4:3') targetRatio = 4 / 3;

  let cropW = effW;
  let cropH = effH;

  if (cropAspect !== 'original') {
    if (effW / effH > targetRatio) {
      cropW = effH * targetRatio;
    } else {
      cropH = effW / targetRatio;
    }
  }

  const sx = (effW - cropW) / 2;
  const sy = (effH - cropH) / 2;

  return {
    width: Math.round(cropW),
    height: Math.round(cropH),
    sx: Math.round(sx),
    sy: Math.round(sy),
    sw: Math.round(cropW),
    sh: Math.round(cropH),
  };
}

export async function processVideoWeb(
  videoMeta: VideoMetadata,
  options: VideoEditOptions,
  onProgress?: (percent: number) => void
): Promise<ProcessResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Web video işleme ortamı mevcut değil.');
  }

  return new Promise((resolve, reject) => {
    try {
      const video = document.createElement('video');
      video.src = videoMeta.uri;
      video.crossOrigin = 'anonymous';
      video.muted = options.muteAudio;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        const duration = video.duration || videoMeta.duration || 1;
        const startSec = Math.max(0, options.trimStart);
        const endSec = Math.min(duration, options.trimEnd > startSec ? options.trimEnd : duration);
        const totalSec = Math.max(0.5, endSec - startSec);

        const crop = calculateCropDimensions(
          video.videoWidth || videoMeta.width || 640,
          video.videoHeight || videoMeta.height || 480,
          options.cropAspect,
          options.rotation
        );

        const canvas = document.createElement('canvas');
        canvas.width = crop.width;
        canvas.height = crop.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Canvas 2D context oluşturulamadı.'));
          return;
        }

        // Setup audio stream destination if not muted
        let audioStream: MediaStream | null = null;
        let audioCtx: AudioContext | null = null;
        if (!options.muteAudio) {
          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
              audioCtx = new AudioContextClass();
              const sourceNode = audioCtx.createMediaElementSource(video);
              const dest = audioCtx.createMediaStreamDestination();
              sourceNode.connect(dest);
              sourceNode.connect(audioCtx.destination);
              audioStream = dest.stream;
            }
          } catch (e) {
            console.warn('AudioContext media source connection failed:', e);
          }
        }

        const canvasStream = canvas.captureStream(30);
        const combinedTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
        if (audioStream && audioStream.getAudioTracks().length > 0) {
          combinedTracks.push(...audioStream.getAudioTracks());
        }

        const combinedStream = new MediaStream(combinedTracks);

        let mimeType = 'video/webm;codecs=vp8,opus';
        if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }

        let mediaRecorder: MediaRecorder;
        try {
          mediaRecorder = new MediaRecorder(combinedStream, { mimeType });
        } catch (e) {
          mediaRecorder = new MediaRecorder(combinedStream);
        }

        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            chunks.push(ev.data);
          }
        };

        mediaRecorder.onstop = () => {
          if (audioCtx) {
            audioCtx.close().catch(() => {});
          }
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'video/webm' });
          const resultUri = URL.createObjectURL(blob);
          const nameParts = videoMeta.name.split('.');
          const baseName = nameParts.length > 1 ? nameParts.slice(0, -1).join('.') : videoMeta.name;
          const outName = `${baseName}_edited.webm`;

          resolve({
            uri: resultUri,
            name: outName,
            type: 'video',
            mimeType: blob.type || 'video/webm',
            size: blob.size,
            duration: totalSec,
          });
        };

        video.currentTime = startSec;

        let renderFrameId: number;
        const renderLoop = () => {
          if (video.currentTime >= endSec || video.ended) {
            video.pause();
            cancelAnimationFrame(renderFrameId);
            if (mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
            return;
          }

          const currentElapsed = video.currentTime - startSec;
          const progressPct = Math.min(100, Math.round((currentElapsed / totalSec) * 100));
          if (onProgress) onProgress(progressPct);

          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Center for rotation
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((options.rotation * Math.PI) / 180);

          // Draw video frame centered
          const drawW = options.rotation === 90 || options.rotation === 270 ? canvas.height : canvas.width;
          const drawH = options.rotation === 90 || options.rotation === 270 ? canvas.width : canvas.height;
          ctx.drawImage(video, -drawW / 2, -drawH / 2, drawW, drawH);

          ctx.restore();

          renderFrameId = requestAnimationFrame(renderLoop);
        };

        video.onseeked = () => {
          mediaRecorder.start(100);
          video.play().then(() => {
            renderLoop();
          }).catch((err) => {
            reject(new Error(`Video oynatımı başlatılamadı: ${err.message}`));
          });
        };
      };

      video.onerror = () => {
        reject(new Error('Video dosyası yüklenirken hata oluştu.'));
      };
    } catch (err: any) {
      reject(err);
    }
  });
}

export async function extractAudioWeb(
  videoMeta: VideoMetadata,
  trimStart: number,
  trimEnd: number,
  onProgress?: (percent: number) => void
): Promise<ProcessResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Web ortamı mevcut değil.');
  }

  return new Promise((resolve, reject) => {
    try {
      const video = document.createElement('video');
      video.src = videoMeta.uri;
      video.crossOrigin = 'anonymous';
      video.muted = false;

      video.onloadedmetadata = () => {
        const duration = video.duration || videoMeta.duration || 1;
        const startSec = Math.max(0, trimStart);
        const endSec = Math.min(duration, trimEnd > startSec ? trimEnd : duration);
        const totalSec = Math.max(0.5, endSec - startSec);

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          reject(new Error('AudioContext bu tarayıcıda desteklenmiyor.'));
          return;
        }

        const audioCtx = new AudioContextClass();
        const sourceNode = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        sourceNode.connect(dest);

        let mimeType = 'audio/webm;codecs=opus';
        if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/webm';
        }

        let mediaRecorder: MediaRecorder;
        try {
          mediaRecorder = new MediaRecorder(dest.stream, { mimeType });
        } catch (e) {
          mediaRecorder = new MediaRecorder(dest.stream);
        }

        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            chunks.push(ev.data);
          }
        };

        mediaRecorder.onstop = () => {
          audioCtx.close().catch(() => {});
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          const resultUri = URL.createObjectURL(blob);
          const nameParts = videoMeta.name.split('.');
          const baseName = nameParts.length > 1 ? nameParts.slice(0, -1).join('.') : videoMeta.name;
          const outName = `${baseName}_audio.webm`;

          resolve({
            uri: resultUri,
            name: outName,
            type: 'audio',
            mimeType: blob.type || 'audio/webm',
            size: blob.size,
            duration: totalSec,
          });
        };

        video.currentTime = startSec;

        const checkProgress = () => {
          if (video.currentTime >= endSec || video.ended) {
            video.pause();
            if (mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
            return;
          }
          const currentElapsed = video.currentTime - startSec;
          const progressPct = Math.min(100, Math.round((currentElapsed / totalSec) * 100));
          if (onProgress) onProgress(progressPct);
          requestAnimationFrame(checkProgress);
        };

        video.onseeked = () => {
          mediaRecorder.start(100);
          video.play().then(() => {
            checkProgress();
          }).catch((err) => {
            reject(new Error(`Ses çıkarma başlatılamadı: ${err.message}`));
          });
        };
      };

      video.onerror = () => {
        reject(new Error('Video seli okunamadı.'));
      };
    } catch (err: any) {
      reject(err);
    }
  });
}

export async function shareOrSaveResult(result: ProcessResult): Promise<void> {
  if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(result.uri);
    return;
  }

  if (typeof document !== 'undefined') {
    const a = document.createElement('a');
    a.href = result.uri;
    a.download = result.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
