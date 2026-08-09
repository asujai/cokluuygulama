export type NfcRecordType = 'text' | 'url' | 'phone' | 'mime';

export interface NfcRecordPayload {
  id: string;
  type: NfcRecordType;
  content: string; // Text string, URL string, or Phone number string
  mimeType?: string; // For mime type records
  lang?: string; // Language code e.g. 'tr' or 'en'
}

export interface ParsedNfcMessage {
  serialNumber?: string;
  records: {
    recordType: string;
    mediaType?: string;
    textData?: string;
    rawPayload?: string;
  }[];
  timestamp: number;
}

export interface NfcCapabilityStatus {
  isSupported: boolean;
  reason?: string;
}

export type NfcOperationStatus = 'idle' | 'scanning_read' | 'scanning_write' | 'success' | 'error';
