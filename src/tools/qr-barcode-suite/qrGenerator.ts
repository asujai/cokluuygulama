import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { QrContentType, QrCorrectionLevel, QrGeneratorState } from './types';

// ==========================================
// 1. Formatting QR Data Payloads
// ==========================================

export function formatQrPayload(state: QrGeneratorState): string {
  switch (state.type) {
    case 'url': {
      let trimmed = state.url.trim();
      if (!trimmed) return 'https://';
      if (!/^https?:\/\//i.test(trimmed)) {
        trimmed = 'https://' + trimmed;
      }
      return trimmed;
    }
    case 'phone': {
      const cleanPhone = state.phone.trim();
      return cleanPhone ? `tel:${cleanPhone}` : '';
    }
    case 'email': {
      const email = state.email.email.trim();
      if (!email) return '';
      const params = new URLSearchParams();
      if (state.email.subject.trim()) params.append('subject', state.email.subject.trim());
      if (state.email.body.trim()) params.append('body', state.email.body.trim());
      const query = params.toString();
      return `mailto:${email}${query ? '?' + query : ''}`;
    }
    case 'wifi': {
      const ssid = state.wifi.ssid.replace(/([\\;,:"])/g, '\\$1');
      const pass = state.wifi.password.replace(/([\\;,:"])/g, '\\$1');
      const auth = state.wifi.encryption;
      const hidden = state.wifi.hidden ? 'H:true;' : '';
      if (auth === 'nopass') {
        return `WIFI:T:nopass;S:${ssid};;${hidden};`;
      }
      return `WIFI:T:${auth};S:${ssid};P:${pass};${hidden};`;
    }
    case 'text':
    default:
      return state.text.trim();
  }
}

// ==========================================
// 2. Pure TypeScript QR Code Matrix Encoder
// ==========================================

const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_EXP[i + 255] = x;
    GF256_LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
  GF256_LOG[0] = 0;
})();

function gfMultiply(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const nextPoly = new Uint8Array(poly.length + 1);
    const root = GF256_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= gfMultiply(poly[j], root);
      nextPoly[j + 1] ^= poly[j];
    }
    poly = nextPoly;
  }
  return poly;
}

function rsCalculateRemainder(data: Uint8Array, numEcBytes: number): Uint8Array {
  const gen = rsGeneratorPoly(numEcBytes);
  const remainder = new Uint8Array(numEcBytes);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    for (let j = 0; j < numEcBytes - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gfMultiply(gen[j + 1], factor);
    }
    remainder[numEcBytes - 1] = gfMultiply(gen[numEcBytes], factor);
  }
  return remainder;
}

// QR Code Specifications for Versions 1 - 10 (sufficient for standard mobile strings up to 600+ chars)
interface QrVersionSpec {
  version: number;
  totalCodewords: number;
  ecCodewords: Record<QrCorrectionLevel, number>;
  blocks: Record<QrCorrectionLevel, number>;
}

const QR_SPECS: QrVersionSpec[] = [
  { version: 1, totalCodewords: 26, ecCodewords: { L: 7, M: 10, Q: 13, H: 17 }, blocks: { L: 1, M: 1, Q: 1, H: 1 } },
  { version: 2, totalCodewords: 44, ecCodewords: { L: 10, M: 16, Q: 22, H: 28 }, blocks: { L: 1, M: 1, Q: 1, H: 1 } },
  { version: 3, totalCodewords: 70, ecCodewords: { L: 15, M: 26, Q: 36, H: 44 }, blocks: { L: 1, M: 1, Q: 2, H: 2 } },
  { version: 4, totalCodewords: 100, ecCodewords: { L: 20, M: 36, Q: 52, H: 64 }, blocks: { L: 1, M: 2, Q: 2, H: 4 } },
  { version: 5, totalCodewords: 134, ecCodewords: { L: 26, M: 48, Q: 72, H: 88 }, blocks: { L: 1, M: 2, Q: 4, H: 4 } },
  { version: 6, totalCodewords: 172, ecCodewords: { L: 36, M: 64, Q: 96, H: 112 }, blocks: { L: 2, M: 4, Q: 4, H: 4 } },
  { version: 7, totalCodewords: 196, ecCodewords: { L: 40, M: 72, Q: 108, H: 130 }, blocks: { L: 2, M: 4, Q: 6, H: 5 } },
  { version: 8, totalCodewords: 242, ecCodewords: { L: 48, M: 88, Q: 132, H: 156 }, blocks: { L: 2, M: 4, Q: 6, H: 6 } },
  { version: 9, totalCodewords: 292, ecCodewords: { L: 60, M: 110, Q: 160, H: 192 }, blocks: { L: 2, M: 5, Q: 8, H: 8 } },
  { version: 10, totalCodewords: 346, ecCodewords: { L: 72, M: 130, Q: 192, H: 224 }, blocks: { L: 4, M: 5, Q: 8, H: 8 } },
];

const ALIGNMENT_LOCATIONS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

const FORMAT_INFO_BITS: Record<QrCorrectionLevel, number[]> = {
  L: [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976],
  M: [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0],
  Q: [0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed],
  H: [0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b],
};

export class QrCodeMatrix {
  public size: number;
  public modules: boolean[][];
  public isFunction: boolean[][];

  constructor(public version: number) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => Array(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => Array(this.size).fill(false));
  }

  public setFunction(r: number, c: number, val: boolean) {
    this.modules[r][c] = val;
    this.isFunction[r][c] = true;
  }
}

export function encodeQrCode(text: string, level: QrCorrectionLevel = 'M'): QrCodeMatrix {
  const utf8Bytes = new TextEncoder().encode(text || ' ');
  const byteCount = utf8Bytes.length;

  // Determine minimal version needed
  let selectedSpec: QrVersionSpec | null = null;
  for (const spec of QR_SPECS) {
    const dataCapacity = spec.totalCodewords - spec.ecCodewords[level];
    // 4 bits mode + 8 bits length (v1-9) or 16 bits (v10) + bytes
    const headerBits = spec.version < 10 ? 4 + 8 : 4 + 16;
    const requiredBits = headerBits + byteCount * 8;
    const requiredBytes = Math.ceil(requiredBits / 8);
    if (requiredBytes <= dataCapacity) {
      selectedSpec = spec;
      break;
    }
  }

  if (!selectedSpec) {
    selectedSpec = QR_SPECS[QR_SPECS.length - 1];
  }

  const version = selectedSpec.version;
  const qr = new QrCodeMatrix(version);
  const numDataCodewords = selectedSpec.totalCodewords - selectedSpec.ecCodewords[level];

  // Bit buffer creation (Byte Mode: 0100)
  const bits: number[] = [];
  const appendBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  appendBits(0b0100, 4); // Byte mode indicator
  appendBits(byteCount, version < 10 ? 8 : 16); // Character count indicator
  for (let i = 0; i < byteCount; i++) {
    appendBits(utf8Bytes[i], 8);
  }

  // Terminator (up to 4 zeroes)
  const remainingBits = numDataCodewords * 8 - bits.length;
  appendBits(0, Math.min(4, Math.max(0, remainingBits)));

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // Pad bytes (0xEC, 0x11 alternate)
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < numDataCodewords * 8) {
    appendBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to byte array
  const dataBytes = new Uint8Array(numDataCodewords);
  for (let i = 0; i < numDataCodewords; i++) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bits[i * 8 + b];
    }
    dataBytes[i] = byteVal;
  }

  // Split into blocks and compute Reed-Solomon EC
  const numBlocks = selectedSpec.blocks[level];
  const ecPerBlock = Math.floor(selectedSpec.ecCodewords[level] / numBlocks);
  const baseBlockSize = Math.floor(numDataCodewords / numBlocks);
  const extraBlocks = numDataCodewords % numBlocks;

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];

  let offset = 0;
  for (let i = 0; i < numBlocks; i++) {
    const size = baseBlockSize + (i >= numBlocks - extraBlocks ? 1 : 0);
    const blockData = dataBytes.slice(offset, offset + size);
    offset += size;
    dataBlocks.push(blockData);
    ecBlocks.push(rsCalculateRemainder(blockData, ecPerBlock));
  }

  // Interleave data and EC
  const finalCodewords: number[] = [];
  const maxBlockLen = baseBlockSize + (extraBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxBlockLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < dataBlocks[b].length) {
        finalCodewords.push(dataBlocks[b][i]);
      }
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) {
      finalCodewords.push(ecBlocks[b][i]);
    }
  }

  // Draw Functional Patterns
  // 1. Finder Patterns (Top-Left, Top-Right, Bottom-Left)
  drawFinderPattern(qr, 0, 0);
  drawFinderPattern(qr, qr.size - 7, 0);
  drawFinderPattern(qr, 0, qr.size - 7);

  // 2. Alignment Patterns
  const alignCoords = ALIGNMENT_LOCATIONS[version] || [];
  for (let r of alignCoords) {
    for (let c of alignCoords) {
      if (
        (r === 6 && c === 6) ||
        (r === 6 && c === qr.size - 7) ||
        (r === qr.size - 7 && c === 6)
      ) {
        continue;
      }
      drawAlignmentPattern(qr, r - 2, c - 2);
    }
  }

  // 3. Timing Patterns
  for (let i = 8; i < qr.size - 8; i++) {
    qr.setFunction(6, i, i % 2 === 0);
    qr.setFunction(i, 6, i % 2 === 0);
  }

  // 4. Dark Module
  qr.setFunction(qr.size - 8, 8, true);

  // 5. Reserve format info areas
  for (let i = 0; i <= 8; i++) {
    qr.setFunction(8, i, false);
    qr.setFunction(i, 8, false);
    qr.setFunction(8, qr.size - 1 - i, false);
    qr.setFunction(qr.size - 1 - i, 8, false);
  }

  // 6. Write Codewords into matrix
  const allBits: number[] = [];
  for (let cw of finalCodewords) {
    for (let i = 7; i >= 0; i--) {
      allBits.push((cw >> i) & 1);
    }
  }

  let bitIdx = 0;
  let dir = -1; // -1: up, 1: down
  for (let c = qr.size - 1; c > 0; c -= 2) {
    if (c === 6) c--; // Skip vertical timing column
    const rows = dir === -1
      ? Array.from({ length: qr.size }, (_, i) => qr.size - 1 - i)
      : Array.from({ length: qr.size }, (_, i) => i);

    for (let r of rows) {
      for (let col of [c, c - 1]) {
        if (!qr.isFunction[r][col]) {
          qr.modules[r][col] = bitIdx < allBits.length ? allBits[bitIdx] === 1 : false;
          bitIdx++;
        }
      }
    }
    dir = -dir;
  }

  // 7. Masking (Mask pattern 0: (row + col) % 2 == 0)
  const maskPattern = 0;
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (!qr.isFunction[r][c]) {
        if ((r + c) % 2 === 0) {
          qr.modules[r][c] = !qr.modules[r][c];
        }
      }
    }
  }

  // 8. Write Format Information (Mask 0)
  const formatBits = FORMAT_INFO_BITS[level][maskPattern];
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> i) & 1) === 1;
    // Top-left area
    if (i <= 5) qr.modules[8][i] = bit;
    else if (i === 6) qr.modules[8][7] = bit;
    else if (i === 7) qr.modules[8][8] = bit;
    else if (i === 8) qr.modules[7][8] = bit;
    else qr.modules[14 - i][8] = bit;

    // Split format bits around borders
    if (i < 8) qr.modules[qr.size - 1 - i][8] = bit;
    else qr.modules[8][qr.size - 15 + i] = bit;
  }

  return qr;
}

function drawFinderPattern(qr: QrCodeMatrix, row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const nr = row + r;
      const nc = col + c;
      if (nr >= 0 && nr < qr.size && nc >= 0 && nc < qr.size) {
        if (
          r === -1 || r === 7 || c === -1 || c === 7 || // Quiet separator
          r === 1 || r === 5 || c === 1 || c === 5      // White ring
        ) {
          qr.setFunction(nr, nc, false);
        } else {
          qr.setFunction(nr, nc, true); // Black box & center
        }
      }
    }
  }
}

function drawAlignmentPattern(qr: QrCodeMatrix, row: number, col: number) {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const isBlack = r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2);
      qr.setFunction(row + r, col + c, isBlack);
    }
  }
}

// ==========================================
// 3. SVG and Canvas Renderers
// ==========================================

export function generateQrSvgString(
  matrix: QrCodeMatrix,
  options: {
    fgColor?: string;
    bgColor?: string;
    size?: number;
    margin?: number;
  } = {}
): string {
  const fgColor = options.fgColor || '#000000';
  const bgColor = options.bgColor || '#FFFFFF';
  const margin = options.margin !== undefined ? options.margin : 4;
  const totalGrid = matrix.size + margin * 2;
  const size = options.size || 512;
  const cellSize = size / totalGrid;

  let paths = '';
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (matrix.modules[r][c]) {
        const x = (c + margin) * cellSize;
        const y = (r + margin) * cellSize;
        paths += `M${x.toFixed(2)},${y.toFixed(2)}h${cellSize.toFixed(2)}v${cellSize.toFixed(2)}h-${cellSize.toFixed(2)}z `;
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="100%" height="100%" fill="${bgColor}" />
  <path d="${paths.trim()}" fill="${fgColor}" shape-rendering="crispEdges" />
</svg>`;
}

export function generateQrSvgDataUri(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}

export async function generateQrPngDataUrl(
  matrix: QrCodeMatrix,
  options: {
    fgColor?: string;
    bgColor?: string;
    size?: number;
    margin?: number;
  } = {}
): Promise<string> {
  const fgColor = options.fgColor || '#000000';
  const bgColor = options.bgColor || '#FFFFFF';
  const margin = options.margin !== undefined ? options.margin : 4;
  const totalGrid = matrix.size + margin * 2;
  const size = options.size || 512;
  const cellSize = Math.floor(size / totalGrid);
  const actualSize = cellSize * totalGrid;

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = actualSize;
    canvas.height = actualSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, actualSize, actualSize);

    ctx.fillStyle = fgColor;
    for (let r = 0; r < matrix.size; r++) {
      for (let c = 0; c < matrix.size; c++) {
        if (matrix.modules[r][c]) {
          ctx.fillRect((c + margin) * cellSize, (r + margin) * cellSize, cellSize, cellSize);
        }
      }
    }
    return canvas.toDataURL('image/png');
  }

  // Fallback to SVG Data URI if DOM is unavailable
  const svg = generateQrSvgString(matrix, options);
  return generateQrSvgDataUri(svg);
}

// ==========================================
// 4. Download & Share Helpers
// ==========================================

export async function downloadOrShareQrCode(
  dataUri: string,
  fileName: string,
  isSvg: boolean = false
): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(dataUri, {
      mimeType: isSvg ? 'image/svg+xml' : 'image/png',
      dialogTitle: 'QR Kodunu Paylaş',
    });
  } else {
    throw new Error('Paylaşım özelliği bu cihazda desteklenmiyor.');
  }
}
