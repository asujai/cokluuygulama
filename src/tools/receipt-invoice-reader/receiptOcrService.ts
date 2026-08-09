import Tesseract from 'tesseract.js';
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { ExtractedReceipt, ReceiptExportFormat, ReceiptItem, ReceiptOcrProgress } from './types';

/**
 * Scans receipt / invoice image with on-device Tesseract OCR and parses fields.
 */
export async function scanReceiptOrInvoice(
  imageUri: string,
  onProgress?: (progress: ReceiptOcrProgress) => void
): Promise<ExtractedReceipt> {
  let rawText = '';

  try {
    const result = await Tesseract.recognize(imageUri, 'tur+eng', {
      logger: (m) => {
        if (onProgress && typeof m.progress === 'number') {
          let label = 'Fiş/Fatura okunuyor...';
          if (m.status.includes('loading')) label = 'OCR Modeli Yükleniyor...';
          if (m.status.includes('recognizing')) label = 'Metin Çıkarılıyor...';
          onProgress({ status: label, progress: m.progress });
        }
      },
    });

    rawText = result.data.text.trim();
  } catch (err) {
    try {
      const result = await Tesseract.recognize(imageUri, 'eng', {
        logger: (m) => {
          if (onProgress && typeof m.progress === 'number') {
            onProgress({ status: 'Metin Taranıyor (Yedek)...', progress: m.progress });
          }
        },
      });
      rawText = result.data.text.trim();
    } catch (fallbackErr) {
      console.error('Receipt OCR failed:', fallbackErr);
      throw new Error('Fiş/Fatura okunamadı. Lütfen görselin net ve aydınlık olduğundan emin olun.');
    }
  }

  return parseReceiptText(rawText);
}

/**
 * Heuristically parses raw OCR text of receipt/invoice into structured data.
 */
export function parseReceiptText(rawText: string): ExtractedReceipt {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let companyName = '';
  let date = '';
  let time = '';
  let totalAmount = 0;
  let currency = 'TL';
  let taxAmount = 0;
  let invoiceNumber = '';
  let paymentMethod = 'Kredi Kartı';
  let category = 'Genel';
  const items: ReceiptItem[] = [];

  // Patterns
  const dateRegex = /(\d{2}[\./-]\d{2}[\./-]\d{2,4})|(\d{4}-\d{2}-\d{2})/;
  const timeRegex = /\b([01]?\d|2[0-3]):[0-5]\d\b/;
  const invoiceNoRegex = /(FİŞ\s*NO|FATURA\s*NO|ETTN|FIŞ\s*NO|FİŞ\s*#|FATURA\s*#)[\s:]*([A-Z0-9-]+)/i;
  const totalRegex = /(TOPLAM|TOTAL|GENEL\s*TOPLAM|ÖDENEN|TUTAR)[\s:*]*([0-9.,]+)/i;
  const taxRegex = /(KDV|VERGİ|TAX)[\s:*%]*([0-9.,]+)/i;

  const knownCompanies = ['BİM', 'MİGROS', 'A101', 'CARREFOUR', 'STARBUCKS', 'SHELL', 'PETROL OFİSİ', 'OPET', 'BP', 'TEKNOSA', 'BOYNER', 'ZARA', 'LC WAIKIKI', 'TRENDYOL', 'HEPSİBURADA', 'GETİR', 'YEMEKSEPETİ'];

  // Company detection
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const lineUpper = lines[i].toUpperCase();
    const found = knownCompanies.find((c) => lineUpper.includes(c));
    if (found) {
      companyName = found;
      break;
    }
  }
  if (!companyName && lines.length > 0) {
    companyName = lines[0].replace(/[^a-zA-Z0-9\s.ğüşıöçĞÜŞİÖÇ-]/g, '').trim();
  }

  // Category detection heuristic based on company name or text
  const textUpper = rawText.toUpperCase();
  if (textUpper.includes('SHELL') || textUpper.includes('OPET') || textUpper.includes('PETROL') || textUpper.includes('BENZİN')) {
    category = 'Akaryakıt / Ulaşım';
  } else if (textUpper.includes('MİGROS') || textUpper.includes('BİM') || textUpper.includes('A101') || textUpper.includes('CARREFOUR') || textUpper.includes('MARKET')) {
    category = 'Market & Gıda';
  } else if (textUpper.includes('STARBUCKS') || textUpper.includes('RESTORAN') || textUpper.includes('CAFE') || textUpper.includes('KAFE')) {
    category = 'Yeme & İçme';
  } else if (textUpper.includes('TEKNOSA') || textUpper.includes('ELEKTRONİK') || textUpper.includes('MEDIA MARKT')) {
    category = 'Elektronik';
  }

  // Date & Time
  const dateMatch = rawText.match(dateRegex);
  if (dateMatch) date = dateMatch[0];

  const timeMatch = rawText.match(timeRegex);
  if (timeMatch) time = timeMatch[0];

  // Invoice / Receipt No
  const invoiceMatch = rawText.match(invoiceNoRegex);
  if (invoiceMatch) invoiceNumber = invoiceMatch[2];

  // Currency detection
  if (rawText.includes('$') || textUpper.includes('USD')) currency = 'USD';
  else if (rawText.includes('€') || textUpper.includes('EUR')) currency = 'EUR';
  else currency = 'TL';

  // Payment Method
  if (textUpper.includes('NAKİT') || textUpper.includes('CASH')) paymentMethod = 'Nakit';
  else if (textUpper.includes('HAVALE') || textUpper.includes('EFT')) paymentMethod = 'Havale / EFT';

  // Line Items & Totals parsing
  const numericPrices: number[] = [];

  lines.forEach((line) => {
    // Check for explicit total line
    const tMatch = line.match(totalRegex);
    if (tMatch) {
      const parsedVal = parseNumberString(tMatch[2]);
      if (parsedVal > 0) numericPrices.push(parsedVal);
    }

    // Check for explicit tax line
    const kMatch = line.match(taxRegex);
    if (kMatch && !taxAmount) {
      const parsedTax = parseNumberString(kMatch[2]);
      if (parsedTax > 0 && parsedTax < 500) taxAmount = parsedTax;
    }

    // Item line parsing: text followed by price like "1 EKMEK 12.50"
    const priceMatch = line.match(/([a-zA-Z0-9\sğüşıöçĞÜŞİÖÇ*.-]+)\s+([0-9]+[.,][0-9]{2})\b/);
    if (priceMatch && !line.toUpperCase().includes('TOPLAM')) {
      const desc = priceMatch[1].trim();
      const val = parseNumberString(priceMatch[2]);
      if (desc.length > 2 && val > 0 && val < 50000) {
        items.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
          description: desc,
          price: val,
        });
        numericPrices.push(val);
      }
    }
  });

  // Extract largest number as total amount
  if (numericPrices.length > 0) {
    totalAmount = Math.max(...numericPrices);
  }

  // Calculate default tax if missing (~%10 average)
  if (!taxAmount && totalAmount > 0) {
    taxAmount = +(totalAmount * 0.1).toFixed(2);
  }

  return {
    companyName: companyName || 'Bilinmeyen İşletme',
    date: date || new Date().toISOString().split('T')[0],
    time: time || '12:00',
    totalAmount: totalAmount || 0,
    currency,
    taxAmount: taxAmount || 0,
    invoiceNumber: invoiceNumber || `F-${Math.floor(100000 + Math.random() * 900000)}`,
    paymentMethod,
    category,
    items,
    rawOcrText: rawText,
  };
}

function parseNumberString(str: string): number {
  if (!str) return 0;
  // Replace Turkish dots/commas format (e.g. 1.250,50 or 125,50)
  let cleaned = str.replace(/[^\d.,]/g, '');
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Format ExtractedReceipt into readable plain text summary.
 */
export function formatReceiptAsText(receipt: ExtractedReceipt): string {
  const lines = [
    `========================================`,
    `FİŞ / FATURA ÖZETİ - ${receipt.companyName.toUpperCase()}`,
    `========================================`,
    `Tarih / Saat : ${receipt.date} ${receipt.time || ''}`,
    `Fiş / Fatura No: ${receipt.invoiceNumber}`,
    `Kategori     : ${receipt.category}`,
    `Ödeme Türü   : ${receipt.paymentMethod}`,
    `----------------------------------------`,
    `KALEMLER:`,
  ];

  if (receipt.items.length > 0) {
    receipt.items.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.description} : ${item.price.toFixed(2)} ${receipt.currency}`);
    });
  } else {
    lines.push(`(Detaylı kalem ayrıştırılamadı)`);
  }

  lines.push(`----------------------------------------`);
  lines.push(`KDV / Vergi  : ${receipt.taxAmount.toFixed(2)} ${receipt.currency}`);
  lines.push(`TOPLAM TUTAR : ${receipt.totalAmount.toFixed(2)} ${receipt.currency}`);
  lines.push(`========================================`);

  return lines.join('\n');
}

/**
 * Format ExtractedReceipt as CSV file string.
 */
export function formatReceiptAsCsv(receipt: ExtractedReceipt): string {
  const rows = [
    ['Firma', 'Tarih', 'Fiş No', 'Kategori', 'Ödeme', 'Açıklama', 'Fiyat', 'Para Birimi'],
  ];

  if (receipt.items.length > 0) {
    receipt.items.forEach((item) => {
      rows.push([
        receipt.companyName,
        receipt.date,
        receipt.invoiceNumber,
        receipt.category,
        receipt.paymentMethod,
        item.description,
        item.price.toFixed(2),
        receipt.currency,
      ]);
    });
  } else {
    rows.push([
      receipt.companyName,
      receipt.date,
      receipt.invoiceNumber,
      receipt.category,
      receipt.paymentMethod,
      'Genel Toplam',
      receipt.totalAmount.toFixed(2),
      receipt.currency,
    ]);
  }

  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
}

/**
 * Export receipt summary in TXT / CSV / JSON format.
 */
export async function exportReceiptFile(
  receipt: ExtractedReceipt,
  format: ReceiptExportFormat
): Promise<void> {
  let content = '';
  let fileName = `fis_${receipt.companyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  let mimeType = 'text/plain';

  if (format === 'csv') {
    content = formatReceiptAsCsv(receipt);
    fileName += '.csv';
    mimeType = 'text/csv';
  } else if (format === 'json') {
    content = JSON.stringify(receipt, null, 2);
    fileName += '.json';
    mimeType = 'application/json';
  } else {
    content = formatReceiptAsText(receipt);
    fileName += '.txt';
    mimeType = 'text/plain';
  }

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  try {
    const cacheDir = FileSystem.Paths.cache.uri.endsWith('/')
      ? FileSystem.Paths.cache.uri
      : `${FileSystem.Paths.cache.uri}/`;
    const fileUri = `${cacheDir}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle: 'Fiş Özetini Paylaş',
      });
    } else {
      throw new Error('Cihazınızda paylaşım desteklenmiyor.');
    }
  } catch (err) {
    console.error('Receipt export failed:', err);
    throw err;
  }
}
