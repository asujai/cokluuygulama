import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import {
  ImageToPdfItem,
  PdfFileItem,
  PdfOperationResult,
  SignatureOptions,
  WatermarkOptions,
} from './types';

type PdfLib = typeof import('pdf-lib');

async function loadPdfLib(): Promise<PdfLib> {
  return import('pdf-lib');
}

// ==========================================
// 1. File Buffer Helpers
// ==========================================

export async function readUriAsBytes(uri: string): Promise<Uint8Array> {
  if (uri.startsWith('data:')) {
    const base64Index = uri.indexOf(';base64,');
    if (base64Index !== -1) {
      const base64 = uri.substring(base64Index + 8);
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
  }

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const index = Math.min(i, units.length - 1);
  const size = bytes / Math.pow(1024, index);
  return `${size.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export async function getPdfPageCount(bytes: Uint8Array): Promise<number> {
  try {
    const { PDFDocument } = await loadPdfLib();
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return pdfDoc.getPageCount();
  } catch (err) {
    console.warn('Could not read page count:', err);
    return 1;
  }
}

// ==========================================
// 2. Core PDF-Lib Operations
// ==========================================

/**
 * Merge multiple PDF files into one.
 */
export async function mergePdfs(
  files: { name: string; bytes: Uint8Array }[]
): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  if (files.length === 0) throw new Error('Birleştirmek için en az bir PDF dosyası seçmelisiniz.');
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const pdf = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
}

/**
 * Split or extract page ranges (e.g. "1-3, 5, 8-10") from a PDF.
 */
export function parsePageRangeString(rangeStr: string, maxPages: number): number[] {
  const pagesSet = new Set<number>();
  const parts = rangeStr.split(/[,;\s]+/).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = Math.max(1, parseInt(startStr, 10) || 1);
      const end = Math.min(maxPages, parseInt(endStr, 10) || maxPages);
      for (let i = start; i <= end; i++) {
        pagesSet.add(i - 1); // 0-indexed
      }
    } else {
      const page = parseInt(part, 10);
      if (!isNaN(page) && page >= 1 && page <= maxPages) {
        pagesSet.add(page - 1); // 0-indexed
      }
    }
  }

  return Array.from(pagesSet).sort((a, b) => a - b);
}

export async function splitPdfPages(
  pdfBytes: Uint8Array,
  rangeStr: string
): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const pageIndices = parsePageRangeString(rangeStr, totalPages);

  if (pageIndices.length === 0) {
    throw new Error('Geçerli bir sayfa aralığı giriniz (Örnek: 1-3, 5).');
  }

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
  copiedPages.forEach((p) => newDoc.addPage(p));

  return await newDoc.save();
}

/**
 * Delete specified page indices (0-indexed).
 */
export async function deletePdfPages(
  pdfBytes: Uint8Array,
  pageIndicesToDelete: number[]
): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const deleteSet = new Set(pageIndicesToDelete);

  const keepIndices: number[] = [];
  for (let i = 0; i < totalPages; i++) {
    if (!deleteSet.has(i)) {
      keepIndices.push(i);
    }
  }

  if (keepIndices.length === 0) {
    throw new Error('Tüm sayfaları silemezsiniz. En az 1 sayfa kalmalıdır.');
  }

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, keepIndices);
  copiedPages.forEach((p) => newDoc.addPage(p));

  return await newDoc.save();
}

/**
 * Rotate PDF pages by 90, 180, 270 degrees.
 */
export async function rotatePdfPages(
  pdfBytes: Uint8Array,
  angle: number,
  targetPageIndices?: number[]
): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await loadPdfLib();
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = doc.getPageCount();
  const pagesToRotate =
    targetPageIndices && targetPageIndices.length > 0
      ? targetPageIndices
      : Array.from({ length: totalPages }, (_, i) => i);

  for (const idx of pagesToRotate) {
    if (idx >= 0 && idx < totalPages) {
      const page = doc.getPage(idx);
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees((currentRotation + angle) % 360));
    }
  }

  return await doc.save();
}

/**
 * Convert a list of images into a multi-page A4 PDF.
 */
export async function imagesToPdf(
  images: ImageToPdfItem[],
  options: { margin?: number } = {}
): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  if (images.length === 0) throw new Error('En az bir görsel eklemelisiniz.');
  const pdfDoc = await PDFDocument.create();
  const margin = options.margin !== undefined ? options.margin : 20;

  // Standard A4 in points (595.28 x 841.89)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const maxDrawWidth = pageWidth - margin * 2;
  const maxDrawHeight = pageHeight - margin * 2;

  for (const imgItem of images) {
    const bytes = await readUriAsBytes(imgItem.uri);
    let embeddedImg;

    // Check if PNG or JPEG
    const isPng =
      imgItem.name.toLowerCase().endsWith('.png') ||
      imgItem.uri.startsWith('data:image/png') ||
      (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50);

    try {
      if (isPng) {
        embeddedImg = await pdfDoc.embedPng(bytes);
      } else {
        embeddedImg = await pdfDoc.embedJpg(bytes);
      }
    } catch {
      // Fallback try other format
      try {
        embeddedImg = await pdfDoc.embedPng(bytes);
      } catch {
        embeddedImg = await pdfDoc.embedJpg(bytes);
      }
    }

    const { width: origWidth, height: origHeight } = embeddedImg;
    const scale = Math.min(maxDrawWidth / origWidth, maxDrawHeight / origHeight);
    const drawWidth = origWidth * scale;
    const drawHeight = origHeight * scale;
    const drawX = margin + (maxDrawWidth - drawWidth) / 2;
    const drawY = margin + (maxDrawHeight - drawHeight) / 2;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(embeddedImg, {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight,
    });
  }

  return await pdfDoc.save();
}

/**
 * Add diagonal text watermark to all pages of a PDF.
 */
export async function addWatermarkToPdf(
  pdfBytes: Uint8Array,
  options: WatermarkOptions
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await loadPdfLib();
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  // Parse color hex (e.g. #DC2626 or #475569)
  const hex = options.color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255 || 0.5;
  const g = parseInt(hex.substring(2, 4), 16) / 255 || 0.5;
  const b = parseInt(hex.substring(4, 6), 16) / 255 || 0.5;

  const watermarkText = options.text.trim() || 'GİZLİ & KOPYALANAMAZ';
  const fontSize = options.fontSize || 42;
  const opacity = Math.max(0.05, Math.min(1, options.opacity || 0.25));

  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    // Center position
    const centerX = width / 2;
    const centerY = height / 2;

    page.drawText(watermarkText, {
      x: centerX - (textWidth / 2) * Math.cos((options.rotationAngle * Math.PI) / 180),
      y: centerY - (textHeight / 2) * Math.sin((options.rotationAngle * Math.PI) / 180),
      size: fontSize,
      font,
      color: rgb(r, g, b),
      opacity,
      rotate: degrees(options.rotationAngle),
    });
  }

  return await doc.save();
}

/**
 * Stamp signature image onto chosen page of a PDF.
 */
export async function addSignatureToPdf(
  pdfBytes: Uint8Array,
  signaturePngDataUrl: string,
  options: SignatureOptions
): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = doc.getPageCount();
  const pageIdx = Math.max(0, Math.min(totalPages - 1, options.pageIndex));
  const page = doc.getPage(pageIdx);
  const { width: pageWidth, height: pageHeight } = page.getSize();

  const sigBytes = await readUriAsBytes(signaturePngDataUrl);
  const embeddedSig = await doc.embedPng(sigBytes);

  const baseSigWidth = 150 * (options.scale || 1);
  const sigAspect = embeddedSig.width / embeddedSig.height;
  const sigWidth = baseSigWidth;
  const sigHeight = baseSigWidth / sigAspect;

  let x = pageWidth - sigWidth - 40;
  let y = 40;

  switch (options.position) {
    case 'bottom-left':
      x = 40;
      y = 40;
      break;
    case 'bottom-center':
      x = (pageWidth - sigWidth) / 2;
      y = 40;
      break;
    case 'center':
      x = (pageWidth - sigWidth) / 2;
      y = (pageHeight - sigHeight) / 2;
      break;
    case 'top-right':
      x = pageWidth - sigWidth - 40;
      y = pageHeight - sigHeight - 40;
      break;
    case 'bottom-right':
    default:
      x = pageWidth - sigWidth - 40;
      y = 40;
      break;
  }

  page.drawImage(embeddedSig, {
    x,
    y,
    width: sigWidth,
    height: sigHeight,
  });

  return await doc.save();
}

// ==========================================
// 3. Export & Share Result
// ==========================================

export async function exportPdfResult(
  pdfBytes: Uint8Array,
  fileName: string
): Promise<PdfOperationResult> {
  let outputUri = '';

  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof Blob !== 'undefined') {
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    outputUri = URL.createObjectURL(blob);
  } else {
    // Convert to base64 Data URI for native
    let binary = '';
    const len = pdfBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(pdfBytes[i]);
    }
    const base64 = btoa(binary);
    outputUri = `data:application/pdf;base64,${base64}`;
  }

  const pageCount = await getPdfPageCount(pdfBytes);

  return {
    uri: outputUri,
    fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
    fileSize: pdfBytes.length,
    pageCount,
  };
}

export async function shareOrDownloadPdfResult(result: PdfOperationResult): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.href = result.uri;
    link.download = result.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(result.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'PDF Belgesini Paylaş',
      UTI: 'com.adobe.pdf',
    });
  } else {
    throw new Error('Paylaşım özelliği bu cihazda desteklenmiyor.');
  }
}
