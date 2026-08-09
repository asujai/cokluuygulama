import { ToolDefinition } from '../../registry/types';
import { ReceiptInvoiceReaderTool } from './ReceiptInvoiceReaderTool';

export const receiptInvoiceReaderTool: ToolDefinition = {
  id: 'receipt-invoice-reader',
  name: 'Fiş & Fatura Okuyucu',
  description: 'Fiş ve fatura fotoğraflarından OCR ile firma, tarih, KDV, toplam tutar ve kalemleri ayıklayın, kopyalayın veya dışa aktarın',
  icon: 'receipt-outline',
  categoryId: 'document',
  route: 'receipt-invoice-reader',
  keywords: [
    'fiş',
    'fis',
    'fatura',
    'fiş okuyucu',
    'fatura okuyucu',
    'kdv',
    'tutar',
    'harcama',
    'gider',
    'ocr',
    'migros',
    'bim',
    'a101',
    'receipt',
    'invoice',
  ].filter((k): k is string => Boolean(k)),
  enabled: true,
  requiresPermission: [
    {
      type: 'media_library',
      name: 'Medya Kitaplığı',
      description: 'Fiş veya fatura görseli seçmek için izin gereklidir.',
    },
    {
      type: 'camera',
      name: 'Kamera',
      description: 'Fiş veya fatura fotoğrafı çekmek için kamera izni gereklidir.',
    },
  ],
  supportedInputTypes: ['image', 'camera'],
  component: ReceiptInvoiceReaderTool,
};

export { ReceiptInvoiceReaderTool };
export * from './types';
export * from './receiptOcrService';
