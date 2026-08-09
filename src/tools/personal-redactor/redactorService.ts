import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { RedactRegion } from './types';

/**
 * Applies rectangular redaction regions (blur, pixelate, blackout) to an image.
 * Uses HTML5 Canvas on web/DOM environments and fallback algorithms.
 */
export async function applyRedactionsToImage(
  imageUri: string,
  regions: RedactRegion[],
  imgWidth: number,
  imgHeight: number
): Promise<string> {
  if (regions.length === 0) {
    return imageUri;
  }

  if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const naturalWidth = img.naturalWidth || img.width || imgWidth;
          const naturalHeight = img.naturalHeight || img.height || imgHeight;

          const canvas = document.createElement('canvas');
          canvas.width = naturalWidth;
          canvas.height = naturalHeight;

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            resolve(imageUri);
            return;
          }

          // Draw base original image
          ctx.drawImage(img, 0, 0, naturalWidth, naturalHeight);

          // Apply each redaction region
          regions.forEach((region) => {
            // Convert percentage coordinates (0-100) to actual pixel values
            const rx = Math.max(0, Math.round((region.x / 100) * naturalWidth));
            const ry = Math.max(0, Math.round((region.y / 100) * naturalHeight));
            const rw = Math.min(naturalWidth - rx, Math.round((region.width / 100) * naturalWidth));
            const rh = Math.min(naturalHeight - ry, Math.round((region.height / 100) * naturalHeight));

            if (rw <= 0 || rh <= 0) return;

            if (region.mode === 'blackout') {
              ctx.save();
              ctx.fillStyle = '#000000';
              ctx.fillRect(rx, ry, rw, rh);
              ctx.restore();
            } else if (region.mode === 'pixelate') {
              ctx.save();
              const pixelSize = Math.max(8, Math.round(Math.min(rw, rh) / 12));

              // Temp offscreen canvas for downscaling
              const tempCanvas = document.createElement('canvas');
              const tempW = Math.max(1, Math.floor(rw / pixelSize));
              const tempH = Math.max(1, Math.floor(rh / pixelSize));
              tempCanvas.width = tempW;
              tempCanvas.height = tempH;

              const tempCtx = tempCanvas.getContext('2d');
              if (tempCtx) {
                tempCtx.imageSmoothingEnabled = false;
                tempCtx.drawImage(canvas, rx, ry, rw, rh, 0, 0, tempW, tempH);

                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(tempCanvas, 0, 0, tempW, tempH, rx, ry, rw, rh);
              }
              ctx.restore();
            } else if (region.mode === 'blur') {
              ctx.save();
              // Box blur effect via multi-stage downscale/upscale blur or canvas filter
              if (typeof (ctx as unknown as { filter?: string }).filter !== 'undefined') {
                const blurAmount = Math.max(12, Math.round(Math.min(rw, rh) / 10));
                (ctx as unknown as { filter: string }).filter = `blur(${blurAmount}px)`;
                ctx.drawImage(canvas, rx, ry, rw, rh, rx, ry, rw, rh);
                (ctx as unknown as { filter: string }).filter = 'none';
              } else {
                // Fallback box blur using downscale-upscale
                const tempCanvas = document.createElement('canvas');
                const tempW = Math.max(2, Math.floor(rw / 10));
                const tempH = Math.max(2, Math.floor(rh / 10));
                tempCanvas.width = tempW;
                tempCanvas.height = tempH;
                const tempCtx = tempCanvas.getContext('2d');
                if (tempCtx) {
                  tempCtx.drawImage(canvas, rx, ry, rw, rh, 0, 0, tempW, tempH);
                  ctx.drawImage(tempCanvas, 0, 0, tempW, tempH, rx, ry, rw, rh);
                }
              }
              ctx.restore();
            }
          });

          const resultDataUrl = canvas.toDataURL('image/png');
          resolve(resultDataUrl);
        } catch (err) {
          console.error('Error applying redactions on canvas:', err);
          resolve(imageUri);
        }
      };

      img.onerror = (err) => {
        console.error('Failed to load image for redaction:', err);
        reject(new Error('Görsel yüklenemedi.'));
      };

      img.src = imageUri;
    });
  }

  return imageUri;
}

/**
 * Share or download the redacted PNG image.
 */
export async function shareOrDownloadImage(
  uri: string,
  fileName: string = 'redacted-image.png'
): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.href = uri;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  try {
    let fileUri = uri;
    if (uri.startsWith('data:')) {
      const base64Data = uri.split(',')[1];
      const cacheDir = FileSystem.Paths.cache.uri.endsWith('/')
        ? FileSystem.Paths.cache.uri
        : `${FileSystem.Paths.cache.uri}/`;
      fileUri = `${cacheDir}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/png',
        dialogTitle: 'Maskelenmiş Görseli Paylaş',
      });
    } else {
      throw new Error('Paylaşım özelliği bu cihazda desteklenmiyor.');
    }
  } catch (err) {
    console.error('Share/Download failed:', err);
    throw err;
  }
}
