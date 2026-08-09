export type SplitUnit = 'B' | 'KB' | 'MB';
export type SplitMode = 'size' | 'count';

export interface FilePartItem {
  partIndex: number; // 1-indexed
  name: string;
  size: number;
  startByte: number;
  endByte: number;
  checksumSha256: string;
  bytes: Uint8Array;
  uri?: string;
}

export interface SplitResult {
  originalFileName: string;
  originalFileSize: number;
  originalChecksumSha256: string;
  totalParts: number;
  parts: FilePartItem[];
}

export interface MergeResult {
  mergedFileName: string;
  mergedFileSize: number;
  mergedChecksumSha256: string;
  checksumMatch: boolean;
  uri: string;
}
