import { Platform } from 'react-native';
import { FilterType } from './types';

export const FILTER_OPTIONS = [
  {
    id: 'original' as FilterType,
    label: 'Orijinal',
    icon: 'image-outline',
    description: 'Filtresiz orijinal görüntü',
  },
  {
    id: 'document' as FilterType,
    label: 'Belge Temizleme',
    icon: 'document-text-outline',
    description: 'Arka planı beyazlatır ve metni keskinleştirir',
  },
  {
    id: 'grayscale' as FilterType,
    label: 'Siyah-Beyaz',
    icon: 'contrast-outline',
    description: 'Gri tonlama filtreleme',
  },
  {
    id: 'contrast' as FilterType,
    label: 'Yüksek Kontrast',
    icon: 'color-wand-outline',
    description: 'Okunabilirliği artıran yüksek kontrast',
  },
];

/**
 * Applies rotation and pixel filters to an image.
 * Uses HTML5 Canvas on web, and returns a processed data URI.
 */
export async function applyImageFilter(
  imageUri: string,
  rotation: number,
  filter: FilterType
): Promise<string> {
  // If no rotation and original filter, return original image URI directly
  if (rotation === 0 && filter === 'original') {
    return imageUri;
  }

  // If in web or standard DOM environment
  if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(imageUri);
            return;
          }

          const normRotation = ((rotation % 360) + 360) % 360;
          const isSideways = normRotation === 90 || normRotation === 270;

          const origWidth = img.naturalWidth || img.width;
          const origHeight = img.naturalHeight || img.height;

          canvas.width = isSideways ? origHeight : origWidth;
          canvas.height = isSideways ? origWidth : origHeight;

          ctx.save();
          if (normRotation === 90) {
            ctx.translate(canvas.width, 0);
            ctx.rotate((90 * Math.PI) / 180);
          } else if (normRotation === 180) {
            ctx.translate(canvas.width, canvas.height);
            ctx.rotate((180 * Math.PI) / 180);
          } else if (normRotation === 270) {
            ctx.translate(0, canvas.height);
            ctx.rotate((270 * Math.PI) / 180);
          }

          ctx.drawImage(img, 0, 0, origWidth, origHeight);
          ctx.restore();

          if (filter !== 'original') {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const len = data.length;

            if (filter === 'grayscale') {
              for (let i = 0; i < len; i += 4) {
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                data[i] = gray;
                data[i + 1] = gray;
                data[i + 2] = gray;
              }
            } else if (filter === 'contrast') {
              // High contrast adjustment
              const contrast = 60; // -255 to 255
              const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
              for (let i = 0; i < len; i += 4) {
                data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
                data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
                data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
              }
            } else if (filter === 'document') {
              // Document cleaning: Clean paper background & enhance dark text
              for (let i = 0; i < len; i += 4) {
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                let out = gray;
                if (gray > 155) {
                  // Whiten background
                  out = Math.min(255, gray + (255 - gray) * 0.85);
                } else {
                  // Darken and sharpen text
                  out = Math.max(0, gray * 0.75 - 10);
                }
                data[i] = out;
                data[i + 1] = out;
                data[i + 2] = out;
              }
            }

            ctx.putImageData(imageData, 0, 0);
          }

          const resultDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          resolve(resultDataUrl);
        } catch (err) {
          console.warn('Canvas filter processing failed:', err);
          resolve(imageUri);
        }
      };
      img.onerror = () => {
        resolve(imageUri);
      };
      img.src = imageUri;
    });
  }

  // Fallback for native non-DOM context
  return imageUri;
}
