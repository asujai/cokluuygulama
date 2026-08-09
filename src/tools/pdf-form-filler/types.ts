export interface FormTextField {
  id: string;
  pageIndex: number;
  label: string;
  value: string;
  x: number; // percentage 0-100 from left
  y: number; // percentage 0-100 from top
  fontSize: number;
  color: string;
}

export interface FormCheckboxField {
  id: string;
  pageIndex: number;
  label: string;
  checked: boolean;
  x: number; // percentage 0-100 from left
  y: number; // percentage 0-100 from top
  size: number;
}

export interface FormSignatureField {
  id: string;
  pageIndex: number;
  label: string;
  imageUri: string; // Base64 PNG signature or image
  x: number; // percentage 0-100 from left
  y: number; // percentage 0-100 from top
  width: number; // percentage 0-100 of page width
  height: number; // percentage 0-100 of page height
}

export interface LoadedPdfInfo {
  uri: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  bytes: Uint8Array;
}

export interface PdfFormFillerResult {
  uri: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
}

export type FormFillerActiveTab = 'text' | 'checkbox' | 'signature' | 'fields' | 'export';
