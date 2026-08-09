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
 * Generates a PDF file from scanned pages using expo-print.
 */
export async function generatePdfFromPages(
  pages: ScannedPage[],
  title: string = 'Taranan_Belge'
): Promise<string> {
  if (!pages || pages.length === 0) {
    throw new Error('PDF oluşturmak için en az bir sayfa eklemelisiniz.');
  }

  const html = buildPdfHtml(pages, title);
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  return uri;
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
