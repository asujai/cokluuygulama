import Tesseract from 'tesseract.js';
import { OcrProgress } from './types';

/**
 * On-device OCR text recognition using Tesseract.js.
 * Extracts text from the provided image URI with progress reporting.
 */
export async function recognizeTextFromImage(
  imageUri: string,
  language: string = 'tur+eng',
  onProgress?: (progress: OcrProgress) => void
): Promise<string> {
  try {
    const result = await Tesseract.recognize(
      imageUri,
      language,
      {
        logger: (message: { status: string; progress: number }) => {
          if (onProgress && typeof message.progress === 'number') {
            let statusLabel = 'Metin tanınıyor...';
            if (message.status.includes('loading')) {
              statusLabel = 'OCR modeli yükleniyor...';
            } else if (message.status.includes('initializing')) {
              statusLabel = 'Hazırlanıyor...';
            } else if (message.status.includes('recognizing')) {
              statusLabel = 'Metin ayrıştırılıyor...';
            }
            onProgress({
              status: statusLabel,
              progress: message.progress,
            });
          }
        },
      }
    );

    return result.data.text.trim();
  } catch (error) {
    // If multilingual tur+eng fails (e.g. offline traineddata loading), try 'eng'
    if (language !== 'eng') {
      try {
        const fallbackResult = await Tesseract.recognize(imageUri, 'eng', {
          logger: (m) => {
            if (onProgress && typeof m.progress === 'number') {
              onProgress({
                status: 'Metin tanınıyor (Yedek mod)...',
                progress: m.progress,
              });
            }
          },
        });
        return fallbackResult.data.text.trim();
      } catch (fallbackError) {
        console.error('OCR fallback recognition failed:', fallbackError);
        throw new Error('Görselden metin çıkarılamadı. Lütfen görüntünün net ve aydınlık olduğundan emin olun.');
      }
    }
    console.error('OCR recognition failed:', error);
    throw new Error('Görselden metin çıkarılamadı. Lütfen görüntünün net ve aydınlık olduğundan emin olun.');
  }
}
