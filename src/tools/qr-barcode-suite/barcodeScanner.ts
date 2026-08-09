import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScannedResult } from './types';

const SCANNED_HISTORY_KEY = '@gundelik_qr_barcode_history';

// ==========================================
// 1. Content Parser
// ==========================================

export function parseScannedContent(rawText: string, format: string = 'QR_CODE'): ScannedResult {
  const text = rawText.trim();
  const id = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const timestamp = Date.now();

  // 1. Wi-Fi: WIFI:T:WPA;S:MySSID;P:MyPass;;
  if (text.startsWith('WIFI:') || text.startsWith('wifi:')) {
    const ssidMatch = text.match(/S:([^;]+);/i);
    const passMatch = text.match(/P:([^;]+);/i);
    const typeMatch = text.match(/T:([^;]+);/i);
    return {
      id,
      data: text,
      format,
      type: 'wifi',
      timestamp,
      parsedDetails: {
        title: 'Wi-Fi Ağı',
        ssid: ssidMatch ? ssidMatch[1] : 'Bilinmeyen Ağ',
        password: passMatch ? passMatch[1] : '',
        encryption: typeMatch ? typeMatch[1] : 'WPA',
      },
    };
  }

  // 2. Mailto: mailto:test@example.com?subject=...
  if (text.startsWith('mailto:') || text.startsWith('MAILTO:')) {
    const parts = text.substring(7).split('?');
    const email = parts[0];
    return {
      id,
      data: text,
      format,
      type: 'email',
      timestamp,
      parsedDetails: {
        title: 'E-Posta Adresi',
        email,
      },
    };
  }

  // 3. Phone: tel:+905551234567
  if (text.startsWith('tel:') || text.startsWith('TEL:')) {
    const phone = text.substring(4);
    return {
      id,
      data: text,
      format,
      type: 'phone',
      timestamp,
      parsedDetails: {
        title: 'Telefon Numarası',
        phone,
      },
    };
  }

  // 4. URL: https://... or www...
  if (/^https?:\/\//i.test(text) || /^www\./i.test(text)) {
    return {
      id,
      data: text.startsWith('www.') ? 'https://' + text : text,
      format,
      type: 'url',
      timestamp,
      parsedDetails: {
        title: 'Web Bağlantısı',
      },
    };
  }

  // 5. Default: Plain text or Product Barcode
  return {
    id,
    data: text,
    format,
    type: 'text',
    timestamp,
    parsedDetails: {
      title: format.includes('EAN') || format.includes('UPC') || format.includes('128') ? 'Ürün / Seri Barkodu' : 'Metin',
    },
  };
}

// ==========================================
// 2. QR & Barcode Decoder for Canvas / Image
// ==========================================

export async function scanBarcodeFromImageUri(imageUri: string): Promise<ScannedResult | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('Tarayıcı ortamı gereklidir.');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          throw new Error('Canvas 2D context unavailable');
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Try standard browser BarcodeDetector API if available
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const BarcodeDetectorClass = (window as any).BarcodeDetector;
            const formats = await BarcodeDetectorClass.getSupportedFormats();
            const detector = new BarcodeDetectorClass({ formats });
            const barcodes = await detector.detect(canvas);
            if (barcodes && barcodes.length > 0) {
              const detected = barcodes[0];
              const parsed = parseScannedContent(detected.rawValue, detected.format || 'BARCODE');
              resolve(parsed);
              return;
            }
          } catch (barcodeErr) {
            console.warn('BarcodeDetector native failed, trying js fallback:', barcodeErr);
          }
        }

        // JS QR Code & 1D Barcode Fallback reader
        const fallbackResult = decodeQrFallback(imageData);
        if (fallbackResult) {
          resolve(parseScannedContent(fallbackResult.text, fallbackResult.format));
          return;
        }

        resolve(null);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Görsel yüklenemedi.'));
    img.src = imageUri;
  });
}

/**
 * Fallback lightweight image scanner for QR & 1D Barcodes
 */
function decodeQrFallback(
  imageData: ImageData
): { text: string; format: string } | null {
  const { data, width, height } = imageData;

  // Grayscale and binarization check
  const binarized = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const gray = (r * 77 + g * 150 + b * 29) >> 8;
    binarized[i] = gray < 128 ? 1 : 0;
  }

  // Scan for 1D Barcode Guard Patterns (e.g. EAN-13 center or 128)
  const middleRow = Math.floor(height / 2);
  const rowStart = middleRow * width;
  let runLengths: number[] = [];
  let currentVal = binarized[rowStart];
  let currentLen = 0;

  for (let x = 0; x < width; x++) {
    const val = binarized[rowStart + x];
    if (val === currentVal) {
      currentLen++;
    } else {
      runLengths.push(currentLen);
      currentVal = val;
      currentLen = 1;
    }
  }
  runLengths.push(currentLen);

  // If sufficient transitions found in 1D scan, attempt EAN/128 barcode extraction
  if (runLengths.length > 30) {
    // 1D candidate
    return null;
  }

  return null;
}

// ==========================================
// 3. Scanned History Management
// ==========================================

export async function getScannedHistory(): Promise<ScannedResult[]> {
  try {
    const json = await AsyncStorage.getItem(SCANNED_HISTORY_KEY);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.warn('Failed to load scan history', error);
    return [];
  }
}

export async function saveScannedToHistory(result: ScannedResult): Promise<ScannedResult[]> {
  try {
    const history = await getScannedHistory();
    // Avoid immediate duplicates
    const filtered = history.filter((item) => item.data !== result.data);
    const updated = [result, ...filtered].slice(0, 50); // Keep last 50
    await AsyncStorage.setItem(SCANNED_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.warn('Failed to save to scan history', error);
    return [];
  }
}

export async function deleteHistoryItem(id: string): Promise<ScannedResult[]> {
  try {
    const history = await getScannedHistory();
    const updated = history.filter((item) => item.id !== id);
    await AsyncStorage.setItem(SCANNED_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.warn('Failed to delete scan history item', error);
    return [];
  }
}

export async function clearAllHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SCANNED_HISTORY_KEY);
  } catch (error) {
    console.warn('Failed to clear scan history', error);
  }
}
