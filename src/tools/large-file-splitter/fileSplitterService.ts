import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import { FilePartItem, MergeResult, SplitMode, SplitResult, SplitUnit } from './types';

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

export async function computeSha256(bytes: Uint8Array): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (err) {
    // Fall back to expo-crypto string digest
  }

  try {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64
    );
  } catch (err) {
    return 'checksum_unavailable';
  }
}

export function getBytesFromUnit(val: number, unit: SplitUnit): number {
  if (unit === 'KB') return Math.round(val * 1024);
  if (unit === 'MB') return Math.round(val * 1024 * 1024);
  return Math.round(val);
}

export async function splitFile(
  fileBytes: Uint8Array,
  fileName: string,
  mode: SplitMode,
  chunkSizeValue: number,
  unit: SplitUnit,
  targetPartCount: number
): Promise<SplitResult> {
  const totalSize = fileBytes.length;
  if (totalSize === 0) {
    throw new Error('Dosya boyutu 0 bayt, bölme yapılamaz.');
  }

  let chunkSize = 1024 * 1024; // Default 1 MB

  if (mode === 'size') {
    chunkSize = getBytesFromUnit(chunkSizeValue, unit);
    if (chunkSize <= 0) chunkSize = 1024;
  } else {
    const parts = Math.max(2, targetPartCount);
    chunkSize = Math.ceil(totalSize / parts);
  }

  const originalChecksum = await computeSha256(fileBytes);

  const partsList: FilePartItem[] = [];
  let start = 0;
  let partIndex = 1;

  while (start < totalSize) {
    const end = Math.min(totalSize, start + chunkSize);
    const chunkBytes = fileBytes.subarray(start, end);
    const partChecksum = await computeSha256(chunkBytes);

    const partName = `${fileName}.part${partIndex}`;

    let partUri = '';
    if (Platform.OS === 'web' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
      const blob = new Blob([chunkBytes as unknown as BlobPart], { type: 'application/octet-stream' });
      partUri = URL.createObjectURL(blob);
    }

    partsList.push({
      partIndex,
      name: partName,
      size: chunkBytes.length,
      startByte: start,
      endByte: end - 1,
      checksumSha256: partChecksum,
      bytes: chunkBytes,
      uri: partUri,
    });

    start = end;
    partIndex++;
  }

  return {
    originalFileName: fileName,
    originalFileSize: totalSize,
    originalChecksumSha256: originalChecksum,
    totalParts: partsList.length,
    parts: partsList,
  };
}

export async function mergeParts(
  parts: { name: string; bytes: Uint8Array }[],
  outputFileName: string,
  expectedChecksum?: string
): Promise<MergeResult> {
  if (!parts || parts.length === 0) {
    throw new Error('Birleştirilecek parça bulunamadı.');
  }

  // Sort parts by numeric suffix (e.g. .part1, .part2...)
  const sorted = [...parts].sort((a, b) => {
    const matchA = a.name.match(/\.part(\d+)$/i);
    const matchB = b.name.match(/\.part(\d+)$/i);
    if (matchA && matchB) {
      return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
    }
    return a.name.localeCompare(b.name);
  });

  let totalLength = 0;
  sorted.forEach((p) => {
    totalLength += p.bytes.length;
  });

  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of sorted) {
    merged.set(part.bytes, offset);
    offset += part.bytes.length;
  }

  const mergedChecksum = await computeSha256(merged);
  const checksumMatch = expectedChecksum
    ? mergedChecksum.toLowerCase() === expectedChecksum.toLowerCase()
    : true;

  let outputUri = '';
  if (Platform.OS === 'web' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
    const blob = new Blob([merged as unknown as BlobPart], { type: 'application/octet-stream' });
    outputUri = URL.createObjectURL(blob);
  } else {
    let binary = '';
    const len = merged.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(merged[i]);
    }
    const base64 = btoa(binary);
    outputUri = `data:application/octet-stream;base64,${base64}`;
  }

  return {
    mergedFileName: outputFileName,
    mergedFileSize: totalLength,
    mergedChecksumSha256: mergedChecksum,
    checksumMatch,
    uri: outputUri,
  };
}

export async function shareOrDownloadFile(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string = 'application/octet-stream'
): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const uri = `data:${mimeType};base64,${base64}`;

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      mimeType,
      dialogTitle: fileName,
    });
  } else {
    throw new Error('Paylaşım özelliği bu cihazda desteklenmiyor.');
  }
}
