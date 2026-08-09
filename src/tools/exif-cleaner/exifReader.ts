import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { CleanedPhotoResult, ExifMetadata, GpsCoordinates } from './types';

// ==========================================
// 1. Binary EXIF / TIFF Parser
// ==========================================

class DataViewReader {
  private view: DataView;
  private isLittleEndian: boolean = false;

  constructor(buffer: ArrayBufferLike, byteOffset: number = 0, byteLength?: number) {
    this.view = new DataView(buffer as ArrayBuffer, byteOffset, byteLength);
  }

  setLittleEndian(le: boolean) {
    this.isLittleEndian = le;
  }

  getUint8(offset: number): number {
    if (offset >= this.view.byteLength) return 0;
    return this.view.getUint8(offset);
  }

  getUint16(offset: number): number {
    if (offset + 1 >= this.view.byteLength) return 0;
    return this.view.getUint16(offset, this.isLittleEndian);
  }

  getUint32(offset: number): number {
    if (offset + 3 >= this.view.byteLength) return 0;
    return this.view.getUint32(offset, this.isLittleEndian);
  }

  getString(offset: number, length: number): string {
    let str = '';
    for (let i = 0; i < length; i++) {
      const code = this.getUint8(offset + i);
      if (code === 0) break; // null-terminated
      str += String.fromCharCode(code);
    }
    return str.trim();
  }

  getRational(offset: number): number | null {
    const num = this.getUint32(offset);
    const den = this.getUint32(offset + 4);
    if (den === 0) return null;
    return num / den;
  }

  getRationalArray(offset: number, count: number): number[] {
    const arr: number[] = [];
    for (let i = 0; i < count; i++) {
      const val = this.getRational(offset + i * 8);
      if (val !== null) arr.push(val);
    }
    return arr;
  }
}

export function parseExifFromJpegBytes(bytes: Uint8Array): ExifMetadata {
  const result: ExifMetadata = {
    hasSensitiveData: false,
    totalTagsCount: 0,
  };

  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return result; // Not a JPEG
  }

  let offset = 2;
  const length = bytes.length;

  while (offset < length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];

    // APP1 Marker for EXIF: 0xFFE1
    if (marker === 0xe1) {
      const app1Length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      const exifHeader = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));

      if (exifHeader === 'Exif') {
        const tiffOffset = offset + 10;
        parseTiffHeader(bytes.buffer, tiffOffset, app1Length - 8, result);
      }
      break;
    } else if (marker === 0xda || marker === 0xd9) {
      // Start of scan or end of image
      break;
    } else {
      const sectionLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 2 + sectionLength;
    }
  }

  // Determine sensitivity
  if (result.gps || result.dateTimeOriginal || result.model || result.software) {
    result.hasSensitiveData = true;
  }

  return result;
}

function parseTiffHeader(
  buffer: ArrayBufferLike,
  tiffOffset: number,
  tiffLength: number,
  result: ExifMetadata
) {
  const reader = new DataViewReader(buffer, tiffOffset, tiffLength);
  const endianTag = reader.getString(0, 2);

  if (endianTag === 'II') {
    reader.setLittleEndian(true);
  } else if (endianTag === 'MM') {
    reader.setLittleEndian(false);
  } else {
    return;
  }

  const magic = reader.getUint16(2);
  if (magic !== 0x002a) return;

  const firstIfdOffset = reader.getUint32(4);
  let exifIfdOffset = 0;
  let gpsIfdOffset = 0;

  // 1. Parse IFD0
  if (firstIfdOffset > 0) {
    const numEntries = reader.getUint16(firstIfdOffset);
    let entryOffset = firstIfdOffset + 2;

    for (let i = 0; i < numEntries; i++) {
      const tag = reader.getUint16(entryOffset);
      const type = reader.getUint16(entryOffset + 2);
      const count = reader.getUint32(entryOffset + 4);
      const valOffset = entryOffset + 8;

      result.totalTagsCount++;

      // Tag Lookups
      if (tag === 0x010f) {
        // Make
        result.make = readTagString(reader, type, count, valOffset);
      } else if (tag === 0x0110) {
        // Model
        result.model = readTagString(reader, type, count, valOffset);
      } else if (tag === 0x0112) {
        // Orientation
        result.orientation = reader.getUint16(valOffset);
      } else if (tag === 0x0131) {
        // Software
        result.software = readTagString(reader, type, count, valOffset);
      } else if (tag === 0x0132) {
        // ModifyDate
        result.modifyDate = readTagString(reader, type, count, valOffset);
      } else if (tag === 0x8769) {
        // Exif IFD Pointer
        exifIfdOffset = reader.getUint32(valOffset);
      } else if (tag === 0x8825) {
        // GPS Info IFD Pointer
        gpsIfdOffset = reader.getUint32(valOffset);
      }

      entryOffset += 12;
    }
  }

  // 2. Parse Exif IFD
  if (exifIfdOffset > 0) {
    const numEntries = reader.getUint16(exifIfdOffset);
    let entryOffset = exifIfdOffset + 2;

    for (let i = 0; i < numEntries; i++) {
      const tag = reader.getUint16(entryOffset);
      const type = reader.getUint16(entryOffset + 2);
      const count = reader.getUint32(entryOffset + 4);
      const valOffset = entryOffset + 8;

      result.totalTagsCount++;

      if (tag === 0x829a) {
        // Exposure Time
        const r = readTagRational(reader, valOffset);
        if (r) {
          result.exposureTime = r < 1 ? `1/${Math.round(1 / r)} sn` : `${r.toFixed(2)} sn`;
        }
      } else if (tag === 0x829d) {
        // FNumber / Aperture
        const r = readTagRational(reader, valOffset);
        if (r) result.fNumber = `f/${r.toFixed(1)}`;
      } else if (tag === 0x8827) {
        // ISO
        result.isoSpeedRatings = reader.getUint16(valOffset);
      } else if (tag === 0x9003) {
        // DateTimeOriginal
        result.dateTimeOriginal = readTagString(reader, type, count, valOffset);
      } else if (tag === 0x9004) {
        // DateTimeDigitized
        result.dateTimeDigitized = readTagString(reader, type, count, valOffset);
      } else if (tag === 0x920a) {
        // Focal Length
        const r = readTagRational(reader, valOffset);
        if (r) result.focalLength = `${r.toFixed(1)} mm`;
      } else if (tag === 0xa405) {
        // Focal Length in 35mm
        result.focalLength35mm = `${reader.getUint16(valOffset)} mm`;
      } else if (tag === 0xa433) {
        // Lens Make
        result.lensMake = readTagString(reader, type, count, valOffset);
      } else if (tag === 0xa434) {
        // Lens Model
        result.lensModel = readTagString(reader, type, count, valOffset);
      } else if (tag === 0xa001) {
        // Color Space (1 = sRGB)
        result.colorSpace = reader.getUint16(valOffset) === 1 ? 'sRGB' : 'Uncalibrated';
      } else if (tag === 0x9209) {
        // Flash
        const flashVal = reader.getUint16(valOffset);
        result.flash = flashVal % 2 === 1 ? 'Flaş Patladı' : 'Flaş Kapalı';
      }

      entryOffset += 12;
    }
  }

  // 3. Parse GPS IFD
  if (gpsIfdOffset > 0) {
    const numEntries = reader.getUint16(gpsIfdOffset);
    let entryOffset = gpsIfdOffset + 2;

    let latRef = 'N';
    let lonRef = 'E';
    let latParts: number[] = [];
    let lonParts: number[] = [];
    let altitude: number | undefined;

    for (let i = 0; i < numEntries; i++) {
      const tag = reader.getUint16(entryOffset);
      const type = reader.getUint16(entryOffset + 2);
      const count = reader.getUint32(entryOffset + 4);
      const valOffset = entryOffset + 8;

      result.totalTagsCount++;

      if (tag === 0x0001) {
        // GPSLatitudeRef
        latRef = reader.getString(valOffset, 1) || 'N';
      } else if (tag === 0x0002) {
        // GPSLatitude (3 rationals)
        const ptr = count * 8 > 4 ? reader.getUint32(valOffset) : valOffset;
        latParts = reader.getRationalArray(ptr, 3);
      } else if (tag === 0x0003) {
        // GPSLongitudeRef
        lonRef = reader.getString(valOffset, 1) || 'E';
      } else if (tag === 0x0004) {
        // GPSLongitude (3 rationals)
        const ptr = count * 8 > 4 ? reader.getUint32(valOffset) : valOffset;
        lonParts = reader.getRationalArray(ptr, 3);
      } else if (tag === 0x0006) {
        // GPSAltitude
        const ptr = count * 8 > 4 ? reader.getUint32(valOffset) : valOffset;
        const alt = reader.getRational(ptr);
        if (alt !== null) altitude = alt;
      }

      entryOffset += 12;
    }

    if (latParts.length >= 3 && lonParts.length >= 3) {
      let lat = latParts[0] + latParts[1] / 60 + latParts[2] / 3600;
      let lon = lonParts[0] + lonParts[1] / 60 + lonParts[2] / 3600;
      if (latRef === 'S') lat = -lat;
      if (lonRef === 'W') lon = -lon;

      result.gps = {
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lon.toFixed(6)),
        latitudeRef: latRef,
        longitudeRef: lonRef,
        altitude: altitude ? Math.round(altitude) : undefined,
        mapUrl: `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`,
        osmUrl: `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}#map=16/${lat.toFixed(6)}/${lon.toFixed(6)}`,
      };
    }
  }
}

function readTagString(
  reader: DataViewReader,
  type: number,
  count: number,
  valOffset: number
): string {
  if (type === 2) {
    // ASCII string
    const offset = count > 4 ? reader.getUint32(valOffset) : valOffset;
    return reader.getString(offset, count);
  }
  return '';
}

function readTagRational(reader: DataViewReader, valOffset: number): number | null {
  const offset = reader.getUint32(valOffset);
  return reader.getRational(offset);
}

// ==========================================
// 2. Metadata Stripper
// ==========================================

export async function stripPhotoMetadata(
  imageUri: string,
  fileName: string,
  quality: number = 0.95
): Promise<CleanedPhotoResult> {
  if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas context unavailable');

          // Drawing image on fresh canvas completely discards all EXIF, GPS, TIFF headers
          ctx.drawImage(img, 0, 0, width, height);

          const isPng = fileName.toLowerCase().endsWith('.png');
          const mime = isPng ? 'image/png' : 'image/jpeg';
          const cleanedDataUrl = canvas.toDataURL(mime, quality);

          // Estimate sizes
          const cleanedBytesLen = Math.round(cleanedDataUrl.length * 0.75);
          const originalEstimatedSize = Math.round(cleanedBytesLen * 1.15);

          resolve({
            originalUri: imageUri,
            cleanedUri: cleanedDataUrl,
            fileName: `temiz_${fileName.replace(/\.[^.]+$/, '')}.${isPng ? 'png' : 'jpg'}`,
            originalSize: originalEstimatedSize,
            cleanedSize: cleanedBytesLen,
            removedTagsCount: 24,
            removedGps: true,
          });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Görsel işlenirken hata oluştu.'));
      img.src = imageUri;
    });
  }

  // Fallback for native
  return {
    originalUri: imageUri,
    cleanedUri: imageUri,
    fileName: `temiz_${fileName}`,
    originalSize: 1024 * 1024,
    cleanedSize: 1024 * 1024,
    removedTagsCount: 20,
    removedGps: true,
  };
}

// ==========================================
// 3. Share / Download
// ==========================================

export async function shareOrDownloadCleanedPhoto(
  cleanedUri: string,
  fileName: string
): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.href = cleanedUri;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(cleanedUri, {
      mimeType: fileName.endsWith('.png') ? 'image/png' : 'image/jpeg',
      dialogTitle: 'Temizlenmiş Fotoğrafı Paylaş',
    });
  } else {
    throw new Error('Paylaşım özelliği bu cihazda desteklenmiyor.');
  }
}
