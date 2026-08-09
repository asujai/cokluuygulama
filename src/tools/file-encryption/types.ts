export type ProcessMode = 'encrypt' | 'decrypt';

export interface SelectedFile {
  name: string;
  size: number;
  uri: string;
  mimeType?: string;
  base64Data?: string;
}

export interface EncryptionResult {
  success: boolean;
  outputUri?: string;
  outputName?: string;
  outputData?: Uint8Array;
  error?: string;
}
