import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { ScannedPage } from './types';

/**
 * Builds HTML document with full-page image layout for multi-page PDF generation.
 */
export function buildPdfHtml(pages: ScannedPage[], documentTitle: string = 'Taranan Belge'): string {
  const pagesHtml = pages
    .map(
      (page, index) => `
    <div class="page-container ${index > 0 ? 'page-break' : ''}">
      <img src="${page.processedUri || page.originalUri}" class="scanned-image" alt="Sayfa ${index + 1}" />
      <div class="page-footer">Sayfa ${index + 1} / ${pages.length}</div>
    </div>
  `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="utf-8">
      <title>${documentTitle}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 0;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #ffffff;
          color: #333333;
        }
        .page-container {
          position: relative;
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background-color: #ffffff;
          page-break-inside: avoid;
        }
        .page-break {
          page-break-before: always;
        }
        .scanned-image {
          max-width: 100%;
          max-height: 92vh;
          object-fit: contain;
          border-radius: 4px;
        }
        .page-footer {
          position: absolute;
          bottom: 12px;
          right: 24px;
          font-size: 11px;
          color: #888888;
        }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `;
}

/**
 * Converts a Data URL or Image URI to JPEG Uint8Array buffer on web.
 */
async function imageUriToJpegBytes(uri: string): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('Web ortamı bulunamadı');
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 800;
      canvas.height = img.naturalHeight || img.height || 1000;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const base64Data = dataUrl.split(',')[1];
      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      resolve({ bytes, width: canvas.width, height: canvas.height });
    };
    img.onerror = () => reject(new Error('Görsel yüklenemedi'));
    img.src = uri;
  });
}

/**
 * Generates a valid multi-page PDF binary Blob in pure JavaScript.
 */
async function createWebPdfBlob(pages: ScannedPage[], title: string): Promise<Blob> {
  const pageImages = await Promise.all(
    pages.map((p) => imageUriToJpegBytes(p.processedUri || p.originalUri))
  );

  const chunks: BlobPart[] = [];
  const offsets: number[] = [];
  let currentOffset = 0;

  const addChunk = (chunk: BlobPart, byteLen?: number) => {
    chunks.push(chunk);
    if (typeof byteLen === 'number') {
      currentOffset += byteLen;
    } else if (typeof chunk === 'string') {
      currentOffset += new TextEncoder().encode(chunk).length;
    } else if (chunk instanceof Uint8Array) {
      currentOffset += chunk.length;
    }
  };

  // PDF Header
  addChunk('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const numPages = pageImages.length;
  // Object 1: Catalog
  // Object 2: Pages
  // For each page:
  // - Object (3 + i*4): Page
  // - Object (4 + i*4): Contents (Draw stream)
  // - Object (5 + i*4): XObject Image

  // Catalog
  offsets[1] = currentOffset;
  addChunk('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Pages kids array
  const kids: string[] = [];
  for (let i = 0; i < numPages; i++) {
    kids.push(`${3 + i * 3} 0 R`);
  }

  offsets[2] = currentOffset;
  addChunk(`2 0 obj\n<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${numPages} >>\nendobj\n`);

  for (let i = 0; i < numPages; i++) {
    const { bytes, width, height } = pageImages[i];
    const pageObjNum = 3 + i * 3;
    const contentObjNum = 4 + i * 3;
    const imageObjNum = 5 + i * 3;

    // Standard A4 dimensions in points: 595.28 x 841.89
    const pageWidth = 595.28;
    const pageHeight = 841.89;

    // Page Object
    offsets[pageObjNum] = currentOffset;
    addChunk(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im${i} ${imageObjNum} 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj\n`
    );

    // Content Stream
    const drawCommand = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im${i} Do Q\n`;
    const drawLen = new TextEncoder().encode(drawCommand).length;
    offsets[contentObjNum] = currentOffset;
    addChunk(
      `${contentObjNum} 0 obj\n<< /Length ${drawLen} >>\nstream\n${drawCommand}endstream\nendobj\n`
    );

    // Image XObject
    offsets[imageObjNum] = currentOffset;
    const imgHeader = `${imageObjNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`;
    addChunk(imgHeader);
    addChunk(bytes as unknown as BlobPart, bytes.length);
    addChunk('\nendstream\nendobj\n');
  }

  // xref table
  const totalObjects = 2 + numPages * 3;
  const xrefOffset = currentOffset;
  addChunk(`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`);
  for (let obj = 1; obj <= totalObjects; obj++) {
    const offStr = String(offsets[obj] || 0).padStart(10, '0');
    addChunk(`${offStr} 00000 n \n`);
  }

  // Trailer
  addChunk(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(chunks, { type: 'application/pdf' });
}

/**
 * Generates a PDF file from scanned pages using expo-print or web Blob engine.
 */
export async function generatePdfFromPages(
  pages: ScannedPage[],
  title: string = 'Taranan_Belge'
): Promise<string> {
  if (!pages || pages.length === 0) {
    throw new Error('PDF oluşturmak için en az bir sayfa eklemelisiniz.');
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const blob = await createWebPdfBlob(pages, title);
      return URL.createObjectURL(blob);
    } catch (webErr) {
      console.warn('Web PDF blob failed, falling back to HTML print:', webErr);
    }
  }

  try {
    const html = buildPdfHtml(pages, title);
    const result = await Print.printToFileAsync({
      html,
      base64: false,
    });
    if (result && result.uri) {
      return result.uri;
    }
  } catch (printErr) {
    console.warn('printToFileAsync error:', printErr);
  }

  // Fallback for web if printToFileAsync fails
  if (typeof window !== 'undefined') {
    const blob = await createWebPdfBlob(pages, title);
    return URL.createObjectURL(blob);
  }

  throw new Error('PDF dosyası oluşturulamadı.');
}

/**
 * Shares or downloads the generated PDF file.
 */
export async function sharePdfFile(
  pdfUri: string,
  fileName: string = 'Taranan_Belge.pdf'
): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    // Web download fallback
    const link = document.createElement('a');
    link.href = pdfUri;
    link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'PDF Belgesini Paylaş',
      UTI: 'com.adobe.pdf',
    });
  } else {
    throw new Error('Bu cihazda paylaşım özelliği desteklenmiyor.');
  }
}
