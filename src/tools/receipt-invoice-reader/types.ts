export interface ReceiptItem {
  id: string;
  description: string;
  price: number;
  quantity?: number;
  taxRate?: number;
}

export interface ExtractedReceipt {
  companyName: string;
  date: string;
  time?: string;
  totalAmount: number;
  currency: string;
  taxAmount: number;
  invoiceNumber: string;
  paymentMethod: string;
  category: string;
  items: ReceiptItem[];
  rawOcrText?: string;
}

export interface ReceiptOcrProgress {
  status: string;
  progress: number;
}

export type ReceiptExportFormat = 'text' | 'csv' | 'json';
