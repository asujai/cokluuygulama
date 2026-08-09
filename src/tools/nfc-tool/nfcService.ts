import { Platform } from 'react-native';
import { NfcCapabilityStatus, NfcRecordPayload, ParsedNfcMessage } from './types';

export function checkNfcCapability(): NfcCapabilityStatus {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      return { isSupported: true };
    }
    return {
      isSupported: false,
      reason:
        'Web NFC API bu tarayıcıda desteklenmiyor. Lütfen Android cihazınızda Google Chrome kullanın veya tarayıcınızda Web NFC özelliğinin aktif olduğundan emin olun.',
    };
  }

  // Native Platform Check
  // Safe check if native NFC manager or module is linked
  try {
    const { NativeModules } = require('react-native');
    if (NativeModules && (NativeModules.NfcManager || NativeModules.NfcManagerModule)) {
      return { isSupported: true };
    }
  } catch (err) {
    // Ignore
  }

  return {
    isSupported: false,
    reason:
      'Cihazınızda NFC donanımı veya NFC modülü aktif değil. Lütfen cihaz ayarlarınızdan NFC özelliğini açın.',
  };
}

let activeNdefController: AbortController | null = null;

export async function readNfcTag(
  onRead: (msg: ParsedNfcMessage) => void,
  onError: (errMessage: string) => void
): Promise<() => void> {
  const cap = checkNfcCapability();
  if (!cap.isSupported) {
    onError(cap.reason || 'NFC desteklenmiyor.');
    return () => {};
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const NDEFReaderClass = (window as any).NDEFReader;
      const ndef = new NDEFReaderClass();
      activeNdefController = new AbortController();

      await ndef.scan({ signal: activeNdefController.signal });

      ndef.onreadingerror = () => {
        onError('NFC etiket okunurken hata oluştu.');
      };

      ndef.onreading = (event: any) => {
        const message = event.message;
        const serialNumber = event.serialNumber || 'NFC_TAG';
        const parsedRecords: any[] = [];

        if (message && message.records) {
          const textDecoder = new TextDecoder();
          for (const rec of message.records) {
            let textData = '';
            if (rec.data) {
              textData = textDecoder.decode(rec.data);
            }
            parsedRecords.push({
              recordType: rec.recordType || 'unknown',
              mediaType: rec.mediaType,
              textData,
              rawPayload: textData,
            });
          }
        }

        onRead({
          serialNumber,
          records: parsedRecords,
          timestamp: Date.now(),
        });
      };

      return () => {
        if (activeNdefController) {
          activeNdefController.abort();
          activeNdefController = null;
        }
      };
    } catch (err: any) {
      onError(err?.message || 'NFC tarayıcı başlatılamadı.');
      return () => {};
    }
  }

  onError('NFC okuma bu ortamda aktif değil.');
  return () => {};
}

export async function writeNfcTag(payload: NfcRecordPayload): Promise<void> {
  const cap = checkNfcCapability();
  if (!cap.isSupported) {
    throw new Error(cap.reason || 'NFC desteklenmiyor.');
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const NDEFReaderClass = (window as any).NDEFReader;
    const ndef = new NDEFReaderClass();

    let recordObj: any = {};

    if (payload.type === 'text') {
      recordObj = {
        recordType: 'text',
        data: payload.content,
        lang: payload.lang || 'tr',
      };
    } else if (payload.type === 'url') {
      const urlStr = payload.content.startsWith('http')
        ? payload.content
        : `https://${payload.content}`;
      recordObj = {
        recordType: 'url',
        data: urlStr,
      };
    } else if (payload.type === 'phone') {
      const phoneUri = payload.content.startsWith('tel:')
        ? payload.content
        : `tel:${payload.content.replace(/\s+/g, '')}`;
      recordObj = {
        recordType: 'url',
        data: phoneUri,
      };
    } else {
      // Mime
      const encoder = new TextEncoder();
      recordObj = {
        recordType: 'mime',
        mediaType: payload.mimeType || 'application/json',
        data: encoder.encode(payload.content),
      };
    }

    await ndef.write({ records: [recordObj] });
    return;
  }

  throw new Error('NFC yazma bu ortamda gerçekleştirilemiyor.');
}
