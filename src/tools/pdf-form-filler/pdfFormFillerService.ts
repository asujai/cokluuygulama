import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import {
  FormCheckboxField,
  FormSignatureField,
  FormTextField,
  PdfFormFillerResult,
} from './types';

type PdfLib = typeof import('pdf-lib');

async function loadPdfLib(): Promise<PdfLib> {
  return import('pdf-lib');
}

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

export async function getPdfPageDimensions(
  bytes: Uint8Array,
  pageIndex: number
): Promise<{ width: number; height: number }> {
  try {
    const { PDFDocument } = await loadPdfLib();
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const targetIndex = Math.max(0, Math.min(pages.length - 1, pageIndex));
    const page = pages[targetIndex];
    const { width, height } = page.getSize();
    return { width, height };
  } catch (err) {
    return { width: 595.28, height: 841.89 }; // Standard A4 points default
  }
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 6) {
    return {
      r: parseInt(cleanHex.substring(0, 2), 16) / 255,
      g: parseInt(cleanHex.substring(2, 4), 16) / 255,
      b: parseInt(cleanHex.substring(4, 6), 16) / 255,
    };
  }
  return { r: 0, g: 0, b: 0 };
}

export async function fillAndExportPdf(
  pdfBytes: Uint8Array,
  textFields: FormTextField[],
  checkboxes: FormCheckboxField[],
  signatures: FormSignatureField[],
  outputFileName: string
): Promise<PdfFormFillerResult> {
  const { PDFDocument, rgb, StandardFonts } = await loadPdfLib();
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  // 1. Process Text Fields
  for (const field of textFields) {
    if (field.pageIndex >= 0 && field.pageIndex < pages.length && field.value) {
      const page = pages[field.pageIndex];
      const { width: pdfW, height: pdfH } = page.getSize();

      const xPt = (field.x / 100) * pdfW;
      const yPt = pdfH - (field.y / 100) * pdfH - field.fontSize;

      const { r, g, b } = parseHexColor(field.color || '#000000');

      page.drawText(field.value, {
        x: Math.max(0, xPt),
        y: Math.max(0, yPt),
        size: field.fontSize || 12,
        font,
        color: rgb(r, g, b),
      });
    }
  }

  // 2. Process Checkboxes
  for (const cb of checkboxes) {
    if (cb.pageIndex >= 0 && cb.pageIndex < pages.length) {
      const page = pages[cb.pageIndex];
      const { width: pdfW, height: pdfH } = page.getSize();

      const sizePt = cb.size || 16;
      const xPt = (cb.x / 100) * pdfW;
      const yPt = pdfH - (cb.y / 100) * pdfH - sizePt;

      // Draw box border
      page.drawRectangle({
        x: Math.max(0, xPt),
        y: Math.max(0, yPt),
        width: sizePt,
        height: sizePt,
        borderWidth: 1.5,
        borderColor: rgb(0, 0, 0),
        color: rgb(1, 1, 1),
      });

      // If checked, draw 'X' or checkmark lines
      if (cb.checked) {
        const padding = sizePt * 0.2;
        page.drawLine({
          start: { x: xPt + padding, y: yPt + padding },
          end: { x: xPt + sizePt - padding, y: yPt + sizePt - padding },
          thickness: 2,
          color: rgb(0, 0, 0),
        });
        page.drawLine({
          start: { x: xPt + padding, y: yPt + sizePt - padding },
          end: { x: xPt + sizePt - padding, y: yPt + padding },
          thickness: 2,
          color: rgb(0, 0, 0),
        });
      }
    }
  }

  // 3. Process Signatures
  for (const sig of signatures) {
    if (sig.pageIndex >= 0 && sig.pageIndex < pages.length && sig.imageUri) {
      const page = pages[sig.pageIndex];
      const { width: pdfW, height: pdfH } = page.getSize();

      try {
        const sigBytes = await readUriAsBytes(sig.imageUri);
        let embeddedImage;
        if (sig.imageUri.includes('image/jpeg') || sig.imageUri.includes('image/jpg')) {
          embeddedImage = await pdfDoc.embedJpg(sigBytes);
        } else {
          embeddedImage = await pdfDoc.embedPng(sigBytes);
        }

        const sigW = (sig.width / 100) * pdfW;
        const sigH = (sig.height / 100) * pdfH;
        const xPt = (sig.x / 100) * pdfW;
        const yPt = pdfH - (sig.y / 100) * pdfH - sigH;

        page.drawImage(embeddedImage, {
          x: Math.max(0, xPt),
          y: Math.max(0, yPt),
          width: Math.max(10, sigW),
          height: Math.max(10, sigH),
        });
      } catch (err) {
        console.warn('Could not embed signature image:', err);
      }
    }
  }

  const savedBytes = await pdfDoc.save();
  const finalFileName = outputFileName.endsWith('.pdf') ? outputFileName : `${outputFileName}.pdf`;

  let outputUri = '';
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof Blob !== 'undefined') {
    const blob = new Blob([savedBytes as unknown as BlobPart], { type: 'application/pdf' });
    outputUri = URL.createObjectURL(blob);
  } else {
    let binary = '';
    const len = savedBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(savedBytes[i]);
    }
    const base64 = btoa(binary);
    outputUri = `data:application/pdf;base64,${base64}`;
  }

  return {
    uri: outputUri,
    fileName: finalFileName,
    fileSize: savedBytes.length,
    pageCount: pages.length,
  };
}

export async function shareOrDownloadPdf(result: PdfFormFillerResult): Promise<void> {
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
      dialogTitle: 'Formlu PDF Belgesini Paylaş',
      UTI: 'com.adobe.pdf',
    });
  } else {
    throw new Error('Paylaşım özelliği bu cihazda desteklenmiyor.');
  }
}
