export type QrContentType = 'text' | 'url' | 'phone' | 'email' | 'wifi';

export type QrCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface WifiData {
  ssid: string;
  password: string;
  encryption: 'WPA' | 'WEP' | 'nopass';
  hidden: boolean;
}

export interface EmailData {
  email: string;
  subject: string;
  body: string;
}

export interface QrGeneratorState {
  type: QrContentType;
  text: string;
  url: string;
  phone: string;
  email: EmailData;
  wifi: WifiData;
  fgColor: string;
  bgColor: string;
  correctionLevel: QrCorrectionLevel;
  size: number;
  includeMargin: boolean;
}

export interface ScannedResult {
  id: string;
  data: string;
  format: string;
  type: 'url' | 'wifi' | 'email' | 'phone' | 'text';
  timestamp: number;
  parsedDetails?: {
    title?: string;
    ssid?: string;
    password?: string;
    encryption?: string;
    email?: string;
    phone?: string;
  };
}

export interface ColorPreset {
  id: string;
  name: string;
  fg: string;
  bg: string;
}
