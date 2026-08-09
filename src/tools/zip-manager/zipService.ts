import JSZip from 'jszip';
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import {
  ZipCompressionLevel,
  ZipArchiveInspection,
  ZipArchiveResult,
  ZipExtractedFileItem,
  ZipInputFile,
} from './types';

// ==========================================
// 1. Helpers
// ==========================================

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

// ==========================================
// 2. Create ZIP Archive
// ==========================================

export async function createZipArchive(
  files: ZipInputFile[],
  archiveName: string = 'Arsiv.zip',
  level: ZipCompressionLevel = 'DEFLATE_NORMAL',
  onProgress?: (percent: number) => void
): Promise<ZipArchiveResult> {
  if (files.length === 0) {
    throw new Error('ZIP arşivi oluşturmak için en az bir dosya eklemelisiniz.');
  }

  const zip = new JSZip();
  let totalOriginalSize = 0;

  for (const file of files) {
    const bytes = file.bytes || (await readUriAsBytes(file.uri));
    totalOriginalSize += bytes.length;
    zip.file(file.name, bytes);
  }

  const compression = level === 'STORE' ? 'STORE' : 'DEFLATE';
  const compressionLevel =
    level === 'DEFLATE_FAST' ? 1 : level === 'DEFLATE_MAX' ? 9 : 6;

  const zipBytes = await zip.generateAsync(
    {
      type: 'uint8array',
      compression,
      compressionOptions: {
        level: compressionLevel,
      },
    },
    (meta) => {
      if (onProgress) onProgress(Math.round(meta.percent));
    }
  );

  let outputUri = '';
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof Blob !== 'undefined') {
    const blob = new Blob([zipBytes as unknown as BlobPart], { type: 'application/zip' });
    outputUri = URL.createObjectURL(blob);
  } else {
    let binary = '';
    const len = zipBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(zipBytes[i]);
    }
    const base64 = btoa(binary);
    outputUri = `data:application/zip;base64,${base64}`;
  }

  const compressedSize = zipBytes.length;
  const savedBytes = Math.max(0, totalOriginalSize - compressedSize);
  const savedPercentage =
    totalOriginalSize > 0 ? Math.round((savedBytes / totalOriginalSize) * 100) : 0;

  return {
    uri: outputUri,
    fileName: archiveName.endsWith('.zip') ? archiveName : `${archiveName}.zip`,
    totalOriginalSize,
    compressedSize,
    savedBytes,
    savedPercentage,
    filesCount: files.length,
  };
}

// ==========================================
// 3. Inspect & Extract ZIP Archive
// ==========================================

export async function inspectZipArchive(
  zipBytes: Uint8Array,
  fileName: string = 'Arsiv.zip'
): Promise<ZipArchiveInspection> {
  const zip = await JSZip.loadAsync(zipBytes);
  const items: ZipExtractedFileItem[] = [];
  let totalUncompressedSize = 0;

  zip.forEach((relativePath, entry) => {
    // Uncompressed size estimation
    const uncompressed = (entry as any)._data?.uncompressedSize || 0;
    const compressed = (entry as any)._data?.compressedSize || uncompressed;
    totalUncompressedSize += uncompressed;

    const baseName = relativePath.split('/').filter(Boolean).pop() || relativePath;

    items.push({
      id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      path: relativePath,
      name: baseName,
      uncompressedSize: uncompressed,
      compressedSize: compressed,
      date: entry.date || new Date(),
      isDirectory: entry.dir,
      comment: entry.comment,
    });
  });

  return {
    fileName,
    totalArchiveSize: zipBytes.length,
    totalUncompressedSize,
    filesCount: items.filter((i) => !i.isDirectory).length,
    items,
  };
}

export async function extractSingleFileFromZip(
  zipBytes: Uint8Array,
  filePath: string,
  fileName: string
): Promise<{ uri: string; size: number }> {
  const zip = await JSZip.loadAsync(zipBytes);
  const entry = zip.file(filePath);
  if (!entry) {
    throw new Error(`Dosya arşiv içinde bulunamadı: ${filePath}`);
  }

  const fileBytes = await entry.async('uint8array');

  let uri = '';
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof Blob !== 'undefined') {
    const mime = getMimeTypeFromFileName(fileName);
    const blob = new Blob([fileBytes as unknown as BlobPart], { type: mime });
    uri = URL.createObjectURL(blob);
  } else {
    let binary = '';
    const len = fileBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(fileBytes[i]);
    }
    const base64 = btoa(binary);
    uri = `data:application/octet-stream;base64,${base64}`;
  }

  return { uri, size: fileBytes.length };
}

function getMimeTypeFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'pdf':
      return 'application/pdf';
    case 'txt':
      return 'text/plain';
    case 'json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

// ==========================================
// 4. Share / Download ZIP
// ==========================================

export async function shareOrDownloadZipResult(
  uri: string,
  fileName: string
): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.href = uri;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/zip',
      dialogTitle: 'ZIP Arşivini Paylaş',
      UTI: 'com.pkware.zip-archive',
    });
  } else {
    throw new Error('Paylaşım özelliği bu cihazda desteklenmiyor.');
  }
}
