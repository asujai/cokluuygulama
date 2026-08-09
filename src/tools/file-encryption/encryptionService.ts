import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const MAGIC_HEADER = new Uint8Array([0x47, 0x45, 0x4e, 0x43]); // "GENC"
const SALT_SIZE = 16;
const IV_SIZE = 12;
const ITERATIONS = 100000;

function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function uint8ArrayToString(arr: Uint8Array): string {
  return new TextDecoder().decode(arr);
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = globalThis.crypto?.subtle || (window as any)?.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API bu ortamda kullanılamıyor.');
  }

  const pwBytes = stringToUint8Array(password);
  const baseKey = await subtle.importKey(
    'raw',
    pwBytes as unknown as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBuffer(data: Uint8Array, password: string): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle || (window as any)?.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API kullanılamıyor.');
  }

  const salt = getRandomBytes(SALT_SIZE);
  const iv = getRandomBytes(IV_SIZE);
  const key = await deriveKey(password, salt);

  const ciphertextBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    data as unknown as BufferSource
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);

  const totalLength = MAGIC_HEADER.length + SALT_SIZE + IV_SIZE + ciphertext.length;
  const result = new Uint8Array(totalLength);

  result.set(MAGIC_HEADER, 0);
  result.set(salt, MAGIC_HEADER.length);
  result.set(iv, MAGIC_HEADER.length + SALT_SIZE);
  result.set(ciphertext, MAGIC_HEADER.length + SALT_SIZE + IV_SIZE);

  return result;
}

export async function decryptBuffer(data: Uint8Array, password: string): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle || (window as any)?.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API kullanılamıyor.');
  }

  const headerOffset = MAGIC_HEADER.length;
  if (data.length < headerOffset + SALT_SIZE + IV_SIZE + 16) {
    throw new Error('Geçersiz şifreli dosya formatı veya yetersiz veri.');
  }

  for (let i = 0; i < MAGIC_HEADER.length; i++) {
    if (data[i] !== MAGIC_HEADER[i]) {
      throw new Error('Seçilen dosya "GENC" biçiminde geçerli bir şifreli dosya değil.');
    }
  }

  const salt = data.subarray(headerOffset, headerOffset + SALT_SIZE);
  const iv = data.subarray(headerOffset + SALT_SIZE, headerOffset + SALT_SIZE + IV_SIZE);
  const ciphertext = data.subarray(headerOffset + SALT_SIZE + IV_SIZE);

  const key = await deriveKey(password, salt);

  try {
    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );
    return new Uint8Array(decryptedBuffer);
  } catch (err) {
    throw new Error('Hatalı şifre veya bozulmuş dosya içeriği.');
  }
}

export async function saveAndExportFile(fileName: string, data: Uint8Array): Promise<string> {
  if (Platform.OS === 'web') {
    const blob = new Blob([data as unknown as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return 'browser_download';
  } else {
    const base64 = uint8ArrayToBase64(data);
    const baseDir = FileSystem.Paths?.cache?.uri || FileSystem.Paths?.document?.uri || '';
    const fileUri = `${baseDir.endsWith('/') ? baseDir : `${baseDir}/`}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    }
    return fileUri;
  }
}
