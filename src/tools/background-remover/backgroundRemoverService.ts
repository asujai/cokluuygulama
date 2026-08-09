import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { BackgroundRemoverOptions, SegmentationResult } from './types';

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
    };
  }
  return { r: 255, g: 255, b: 255 };
}

/**
 * Performs local, deterministic color/edge background segmentation using HTML Canvas.
 */
export async function removeBackground(
  imageUri: string,
  options: BackgroundRemoverOptions
): Promise<SegmentationResult> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return {
      outputUri: imageUri,
      width: 800,
      height: 600,
      removedPixelsPercentage: 0,
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        // Downscale very large images to max 1600px width/height for fast canvas processing
        const maxDim = 1600;
        let scale = 1;
        if (origW > maxDim || origH > maxDim) {
          scale = maxDim / Math.max(origW, origH);
        }

        const width = Math.round(origW * scale);
        const height = Math.round(origH * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve({
            outputUri: imageUri,
            width,
            height,
            removedPixelsPercentage: 0,
          });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Determine reference background color(s)
        let refR = 255;
        let refG = 255;
        let refB = 255;

        if (options.sampleKeyColor) {
          const parsed = parseHex(options.sampleKeyColor);
          refR = parsed.r;
          refG = parsed.g;
          refB = parsed.b;
        } else {
          // Sample 4 corners to estimate ambient background color
          const sampleIndices = [
            0, // top-left
            (width - 1) * 4, // top-right
            (width * (height - 1)) * 4, // bottom-left
            (width * height - 1) * 4, // bottom-right
          ];

          let sumR = 0;
          let sumG = 0;
          let sumB = 0;

          sampleIndices.forEach((idx) => {
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
          });

          refR = Math.round(sumR / 4);
          refG = Math.round(sumG / 4);
          refB = Math.round(sumB / 4);
        }

        // Map tolerance (0-100) to max Euclidean RGB distance (0-200)
        const maxDistThreshold = (options.tolerance / 100) * 180 + 10;
        const featherWidth = options.feather || 2;

        let removedCount = 0;
        const totalPixels = width * height;

        // Solid background RGB if not transparent
        const targetSolid = options.fillMode === 'white'
          ? { r: 255, g: 255, b: 255 }
          : parseHex(options.solidColor || '#FFFFFF');

        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Euclidean color distance to background reference
          const dist = Math.sqrt(
            (r - refR) ** 2 + (g - refG) ** 2 + (b - refB) ** 2
          );

          // Skin tone check heuristic to preserve subject faces/skin if enabled
          const isSkinTone =
            options.preserveSubjectSkin &&
            r > 95 &&
            g > 40 &&
            b > 20 &&
            r > g &&
            r > b &&
            Math.abs(r - g) > 15;

          if (!isSkinTone && dist < maxDistThreshold) {
            removedCount++;

            // Calculate smooth alpha transition for edge feathering
            let alpha = 0;
            if (featherWidth > 0 && dist > maxDistThreshold - featherWidth * 15) {
              const transitionRatio =
                (dist - (maxDistThreshold - featherWidth * 15)) /
                (featherWidth * 15);
              alpha = Math.round(Math.min(255, Math.max(0, transitionRatio * 255)));
            }

            if (options.fillMode === 'transparent') {
              data[idx + 3] = alpha;
            } else {
              // Blend with solid target color
              const alphaRatio = alpha / 255;
              data[idx] = Math.round(r * alphaRatio + targetSolid.r * (1 - alphaRatio));
              data[idx + 1] = Math.round(g * alphaRatio + targetSolid.g * (1 - alphaRatio));
              data[idx + 2] = Math.round(b * alphaRatio + targetSolid.b * (1 - alphaRatio));
              data[idx + 3] = 255;
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        const outputUri = canvas.toDataURL('image/png');

        resolve({
          outputUri,
          width,
          height,
          removedPixelsPercentage: Math.round((removedCount / totalPixels) * 100),
        });
      } catch (err: any) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Görsel yüklenirken hata oluştu.'));
    };

    img.src = imageUri;
  });
}

export async function shareOrDownloadImage(
  imageUri: string,
  fileName: string = 'arka_plan_silinmis.png'
): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.href = imageUri;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(imageUri, {
      mimeType: 'image/png',
      dialogTitle: 'Arka Planı Silinmiş Görseli Paylaş',
    });
  } else {
    throw new Error('Paylaşım özelliği bu cihazda desteklenmiyor.');
  }
}
