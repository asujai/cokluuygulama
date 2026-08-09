export type ZipToolMode = 'create' | 'extract';

export type ZipCompressionLevel = 'STORE' | 'DEFLATE_FAST' | 'DEFLATE_NORMAL' | 'DEFLATE_MAX';

export interface ZipInputFile {
  id: string;
  name: string;
  uri: string;
  size: number;
  type?: string;
  bytes?: Uint8Array;
}

export interface ZipArchiveResult {
  uri: string;
  fileName: string;
  totalOriginalSize: number;
  compressedSize: number;
  savedBytes: number;
  savedPercentage: number;
  filesCount: number;
}

export interface ZipExtractedFileItem {
  id: string;
  path: string;
  name: string;
  uncompressedSize: number;
  compressedSize: number;
  date: Date;
  isDirectory: boolean;
  comment?: string;
  extractedUri?: string;
}

export interface ZipArchiveInspection {
  fileName: string;
  totalArchiveSize: number;
  totalUncompressedSize: number;
  filesCount: number;
  items: ZipExtractedFileItem[];
}
