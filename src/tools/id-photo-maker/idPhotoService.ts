import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { BgColorOption, IdPhotoResult, PhotoPreset, PrintSheetOptions } from './types';

export const PHOTO_PRESETS: PhotoPreset[] = [
  {
    id: 'biometric-35x45',
    name: '35x45 mm Biyometrik (Pasaport / Ehliyet / T.C. Kimlik)',
    widthMm: 35,
    heightMm: 45,
    aspectRatio: 35 / 45,
    description: 'Türkiye T.C. Kimlik, Pasaport, Ehliyet ve AB Vize standartı',
  },
  {
    id: 'visa-50x50',
    name: '50x50 mm (2x2 inch) Vize (ABD / Kanada / Hindistan)',
    widthMm: 50,
    heightMm: 50,
    aspectRatio: 1,
    description: 'ABD Vizesi, Yeşil Kart (DV Lottery) ve Kanada Vize standartı',
  },
  {
    id: 'classic-30x40',
    name: '30x40 mm Vesikalık Klasik',
    widthMm: 30,
    heightMm: 40,
    aspectRatio: 30 / 40,
    description: 'Öğrenci belgesi, kurum kartları ve standart vesikalık',
  },
  {
    id: 'mini-20x30',
    name: '20x30 mm Mini Vesikalık',
    widthMm: 20,
    heightMm: 30,
    aspectRatio: 20 / 30,
    description: 'Özel üye kartları ve mini belgeler için',
  },
];

export const BG_COLOR_OPTIONS: BgColorOption[] = [
  { id: 'white', label: 'Beyaz (Standart)', color: '#FFFFFF' },
  { id: 'light-blue', label: 'Açık Mavi', color: '#E0F2FE' },
  { id: 'light-gray', label: 'Açık Gri', color: '#F1F5F9' },
  { id: 'navy', label: 'Koyu Mavi', color: '#1E3A8A' },
  { id: 'red', label: 'Kırmızı', color: '#DC2626' },
  { id: 'original', label: 'Orijinal Arka Plan', color: 'transparent' },
];

/**
 * Applies background replacement segmentation heuristic on canvas and crops to preset.
 */
export async function processIdPhoto(
  imageUri: string,
  preset: PhotoPreset,
  targetBgColor: string,
  zoomLevel: number = 1.0,
  headYOffset: number = 0
): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return imageUri;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        // Target high-res canvas size for ID photo (e.g., 700x900px for 35x45mm)
        const targetW = 800;
        const targetH = Math.round(targetW / preset.aspectRatio);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(imageUri);
          return;
        }

        // Fill background color if non-transparent
        if (targetBgColor !== 'transparent') {
          ctx.fillStyle = targetBgColor;
          ctx.fillRect(0, 0, targetW, targetH);
        }

        // Calculate source cropping region according to zoom and head alignment
        const aspect = preset.aspectRatio;
        let cropW = origW / zoomLevel;
        let cropH = cropW / aspect;

        if (cropH > origH) {
          cropH = origH / zoomLevel;
          cropW = cropH * aspect;
        }

        const cropX = Math.max(0, (origW - cropW) / 2);
        // Apply head alignment vertical offset
        const cropY = Math.max(0, Math.min(origH - cropH, (origH - cropH) / 2 + (headYOffset / 100) * (origH / 4)));

        // Draw cropped photo onto canvas
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

        // Apply local background segmentation heuristic if background replacement is enabled
        if (targetBgColor !== 'transparent') {
          const imageData = ctx.getImageData(0, 0, targetW, targetH);
          const data = imageData.data;

          // Parse target background RGB
          const hex = targetBgColor.replace('#', '');
          const targetR = parseInt(hex.substring(0, 2), 16);
          const targetG = parseInt(hex.substring(2, 4), 16);
          const targetB = parseInt(hex.substring(4, 6), 16);

          // Sample corners for background color estimation
          const sampleIndices = [0, (targetW - 1) * 4, (targetW * 20) * 4];
          let refR = 0, refG = 0, refB = 0;
          sampleIndices.forEach((idx) => {
            refR += data[idx];
            refG += data[idx + 1];
            refB += data[idx + 2];
          });
          refR = Math.round(refR / sampleIndices.length);
          refG = Math.round(refG / sampleIndices.length);
          refB = Math.round(refB / sampleIndices.length);

          const totalPixels = targetW * targetH;
          for (let i = 0; i < totalPixels; i++) {
            const idx = i * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            const py = Math.floor(i / targetW);

            // Calculate distance to corner background reference color
            const distRef = Math.sqrt((r - refR) ** 2 + (g - refG) ** 2 + (b - refB) ** 2);

            // Skin color detection heuristic (YCbCr / HSV approx)
            const isSkinTone = r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15;

            // Only remove background in non-skin areas or top/outer borders
            if (!isSkinTone && (distRef < 65 || py < targetH * 0.15)) {
              data[idx] = targetR;
              data[idx + 1] = targetG;
              data[idx + 2] = targetB;
              data[idx + 3] = 255;
            }
          }

          ctx.putImageData(imageData, 0, 0);
        }

        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      } catch (err) {
        console.error('ID Photo processing error:', err);
        resolve(imageUri);
      }
    };

    img.onerror = () => {
      reject(new Error('Görsel okunamadı.'));
    };

    img.src = imageUri;
  });
}

/**
 * Creates 10x15cm (4x6 inch) print layout PNG containing multiple ID photos with crop guides.
 */
export async function createPrintSheetImage(
  singlePhotoUri: string,
  preset: PhotoPreset,
  options: PrintSheetOptions
): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return singlePhotoUri;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // 4x6 inch at 300 DPI = 1200 x 1800 px
        const sheetW = 1200;
        const sheetH = 1800;

        const canvas = document.createElement('canvas');
        canvas.width = sheetW;
        canvas.height = sheetH;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(singlePhotoUri);
          return;
        }

        // Sheet background
        ctx.fillStyle = options.backgroundColor || '#FFFFFF';
        ctx.fillRect(0, 0, sheetW, sheetH);

        const count = options.photosPerPage || 6;
        const cols = count <= 4 ? 2 : 2;
        const rows = Math.ceil(count / cols);

        // Tile dimensions (scaled to fit nicely inside paper margins)
        const photoW = preset.aspectRatio >= 1 ? 480 : 420;
        const photoH = Math.round(photoW / preset.aspectRatio);

        const gapX = Math.round((sheetW - cols * photoW) / (cols + 1));
        const gapY = Math.round((sheetH - rows * photoH) / (rows + 1));

        for (let i = 0; i < count; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);

          const x = gapX + col * (photoW + gapX);
          const y = gapY + row * (photoH + gapY);

          // Draw ID photo tile
          ctx.drawImage(img, x, y, photoW, photoH);

          // Draw crop marks / trim lines if enabled
          if (options.showCropMarks) {
            ctx.strokeStyle = '#CBD5E1';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, photoW, photoH);
          }
        }

        // Draw header watermark / guide
        ctx.fillStyle = '#64748B';
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          `Gündelik Vesikalık Baskı Şablonu (10x15 cm / 4x6") - ${preset.name}`,
          sheetW / 2,
          sheetH - 30
        );

        const resultDataUrl = canvas.toDataURL('image/png');
        resolve(resultDataUrl);
      } catch (err) {
        console.error('Print sheet creation error:', err);
        resolve(singlePhotoUri);
      }
    };

    img.onerror = () => resolve(singlePhotoUri);
    img.src = singlePhotoUri;
  });
}

/**
 * Exports print sheet as PDF file.
 */
export async function exportPrintSheetPdf(
  printSheetUri: string,
  preset: PhotoPreset
): Promise<string> {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: 100mm 150mm; margin: 0; }
        body { margin: 0; padding: 0; background: #ffffff; text-align: center; }
        img { width: 100%; height: 100%; object-fit: contain; }
      </style>
    </head>
    <body>
      <img src="${printSheetUri}" />
    </body>
    </html>
  `;

  try {
    const file = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });
    return file.uri;
  } catch (err) {
    console.error('PDF export failed:', err);
    throw err;
  }
}

/**
 * Share or download file locally.
 */
export async function shareOrDownloadFile(
  uri: string,
  fileName: string,
  mimeType: string = 'image/png'
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
      const cacheDir = FileSystem.Paths.cache.uri.endsWith('/')
        ? FileSystem.Paths.cache.uri
        : `${FileSystem.Paths.cache.uri}/`;
      targetUri = `${cacheDir}${fileName}`;
      await FileSystem.writeAsStringAsync(targetUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(targetUri, { mimeType, dialogTitle: 'Baskı Dosyasını Paylaş' });
    } else {
      throw new Error('Cihazınızda paylaşım desteklenmiyor.');
    }
  } catch (err) {
    console.error('Share/Download failed:', err);
    throw err;
  }
}
