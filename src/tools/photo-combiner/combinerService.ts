import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { CombinerOptions, CombinerResult, PhotoItem } from './types';

/**
 * Stitches multiple photos vertically or horizontally into one combined image.
 */
export async function combinePhotos(
  photos: PhotoItem[],
  options: CombinerOptions
): Promise<CombinerResult> {
  if (!photos || photos.length === 0) {
    throw new Error('Birleştirilecek fotoğraf bulunamadı.');
  }

  if (photos.length === 1 && options.spacing === 0 && options.padding === 0 && options.borderRadius === 0) {
    return {
      outputUri: photos[0].uri,
      width: photos[0].width || 800,
      height: photos[0].height || 600,
      totalImages: 1,
    };
  }

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return {
      outputUri: photos[0].uri,
      width: 800,
      height: 600,
      totalImages: photos.length,
    };
  }

  // Load all images asynchronously
  const loadedImages = await Promise.all(
    photos.map(
      (photo) =>
        new Promise<{ img: HTMLImageElement; item: PhotoItem }>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve({ img, item: photo });
          img.onerror = () => reject(new Error(`Görsel yüklenemedi: ${photo.uri}`));
          img.src = photo.uri;
        })
    )
  );

  const isVertical = options.direction === 'vertical';
  const padding = options.padding || 0;
  const spacing = options.spacing || 0;
  const radius = options.borderRadius || 0;

  // Determine standard reference dimension across items
  let canvasW = 0;
  let canvasH = 0;

  if (isVertical) {
    // Standardize to max width or default 1200px
    const targetWidth = Math.min(2400, Math.max(800, ...loadedImages.map((l) => l.img.naturalWidth || l.item.width || 800)));
    let totalContentH = 0;

    const itemRects = loadedImages.map(({ img, item }) => {
      const origW = img.naturalWidth || item.width || 800;
      const origH = img.naturalHeight || item.height || 600;
      const aspect = origW / origH;

      const drawW = targetWidth;
      const drawH = Math.round(drawW / aspect);
      const yPos = padding + totalContentH;
      totalContentH += drawH + spacing;

      return { img, drawW, drawH, xPos: padding, yPos };
    });

    // Remove extra trailing spacing
    totalContentH = Math.max(0, totalContentH - spacing);
    canvasW = targetWidth + padding * 2;
    canvasH = totalContentH + padding * 2;

    return renderCanvas(canvasW, canvasH, itemRects, options, photos.length);
  } else {
    // Horizontal stitching: standardize to target height
    const targetHeight = Math.min(2400, Math.max(600, ...loadedImages.map((l) => l.img.naturalHeight || l.item.height || 600)));
    let totalContentW = 0;

    const itemRects = loadedImages.map(({ img, item }) => {
      const origW = img.naturalWidth || item.width || 800;
      const origH = img.naturalHeight || item.height || 600;
      const aspect = origW / origH;

      const drawH = targetHeight;
      const drawW = Math.round(drawH * aspect);
      const xPos = padding + totalContentW;
      totalContentW += drawW + spacing;

      return { img, drawW, drawH, xPos, yPos: padding };
    });

    totalContentW = Math.max(0, totalContentW - spacing);
    canvasW = totalContentW + padding * 2;
    canvasH = targetHeight + padding * 2;

    return renderCanvas(canvasW, canvasH, itemRects, options, photos.length);
  }
}

/**
 * Render rect items onto HTML5 Canvas with rounded corners & background color.
 */
function renderCanvas(
  width: number,
  height: number,
  items: { img: HTMLImageElement; drawW: number; drawH: number; xPos: number; yPos: number }[],
  options: CombinerOptions,
  totalCount: number
): CombinerResult {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D bağlamı oluşturulamadı.');
  }

  // Draw background color
  if (options.backgroundColor && options.backgroundColor !== 'transparent') {
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  const radius = options.borderRadius || 0;

  // Draw each image tile
  items.forEach(({ img, drawW, drawH, xPos, yPos }) => {
    ctx.save();

    if (radius > 0) {
      // Rounded rect clip path
      ctx.beginPath();
      ctx.moveTo(xPos + radius, yPos);
      ctx.arcTo(xPos + drawW, yPos, xPos + drawW, yPos + drawH, radius);
      ctx.arcTo(xPos + drawW, yPos + drawH, xPos, yPos + drawH, radius);
      ctx.arcTo(xPos, yPos + drawH, xPos, yPos, radius);
      ctx.arcTo(xPos, yPos, xPos + drawW, yPos, radius);
      ctx.closePath();
      ctx.clip();
    }

    ctx.drawImage(img, xPos, yPos, drawW, drawH);
    ctx.restore();
  });

  const outputUri = canvas.toDataURL('image/png');
  return {
    outputUri,
    width,
    height,
    totalImages: totalCount,
  };
}

/**
 * Share or download combined image.
 */
export async function shareOrDownloadCombinedImage(
  uri: string,
  fileName: string = 'combined_photo.png'
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
    let targetUri = uri;
    if (uri.startsWith('data:')) {
      const base64Data = uri.split(',')[1];
      targetUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(targetUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(targetUri, {
        mimeType: 'image/png',
        dialogTitle: 'Birleştirilmiş Görseli Paylaş',
      });
    } else {
      throw new Error('Paylaşım özelliği cihazda desteklenmiyor.');
    }
  } catch (err) {
    console.error('Share/Download failed:', err);
    throw err;
  }
}
