export type PdfToolMode =
  | 'merge'
  | 'split'
  | 'rotate'
  | 'images_to_pdf'
  | 'watermark'
  | 'signature';

export interface PdfFileItem {
  id: string;
  name: string;
  uri: string;
  size: number;
  pageCount?: number;
  bytes?: Uint8Array;
}

export interface ImageToPdfItem {
  id: string;
  name: string;
  uri: string;
  width?: number;
  height?: number;
  size?: number;
}

export interface WatermarkOptions {
  text: string;
  opacity: number;
  fontSize: number;
  color: string;
  rotationAngle: number;
}

export interface SignatureOptions {
  pageIndex: number;
  position: 'bottom-right' | 'bottom-left' | 'center' | 'top-right' | 'bottom-center';
  scale: number;
}

export interface PdfOperationResult {
  uri: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
}
