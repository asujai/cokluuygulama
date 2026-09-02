import { normalizeTurkishText, matchesTurkishQuery } from './turkishUtils';

export interface IntentAlias {
  id: string;
  intent: string;
  normalizedIntent: string;
  toolIds: string[];
  description?: string;
  icon?: string;
}

export const INTENT_ALIASES: IntentAlias[] = [
  {
    id: 'pdf-compress',
    intent: 'PDF küçült',
    normalizedIntent: normalizeTurkishText('PDF küçült'),
    toolIds: ['pdf-toolbox', 'media-compressor'],
    description: 'PDF dosya boyutunu sıkıştırın ve küçültün',
    icon: 'document-text-outline',
  },
  {
    id: 'exif-clean',
    intent: 'fotoğraftaki bilgileri sil',
    normalizedIntent: normalizeTurkishText('fotoğraftaki bilgileri sil'),
    toolIds: ['exif-cleaner'],
    description: 'Fotoğraflardaki konum (GPS) ve kamera meta verilerini temizleyin',
    icon: 'shield-checkmark-outline',
  },
  {
    id: 'video-gif',
    intent: 'videoyu GIF yap',
    normalizedIntent: normalizeTurkishText('videoyu GIF yap'),
    toolIds: ['video-to-gif'],
    description: 'Videoları kırpıp animasyonlu GIF üretin',
    icon: 'film-outline',
  },
  {
    id: 'file-encrypt',
    intent: 'dosyayı şifrele',
    normalizedIntent: normalizeTurkishText('dosyayı şifrele'),
    toolIds: ['file-encryption'],
    description: 'AES-256 ile dosyalarınızı parola ile güvenli şifreleyin',
    icon: 'lock-closed-outline',
  },
  {
    id: 'photo-combine',
    intent: 'iki fotoğrafı birleştir',
    normalizedIntent: normalizeTurkishText('iki fotoğrafı birleştir'),
    toolIds: ['photo-combiner'],
    description: 'Birden fazla görseli yan yana veya alt alta birleştirin',
    icon: 'image-outline',
  },
  {
    id: 'bg-remove',
    intent: 'arka planı sil',
    normalizedIntent: normalizeTurkishText('arka planı sil'),
    toolIds: ['background-remover'],
    description: 'Fotoğrafların arka planını yapay zekasız yerel algoritmalarla temizleyin',
    icon: 'cut-outline',
  },
  {
    id: 'qr-generate',
    intent: 'QR kod oluştur',
    normalizedIntent: normalizeTurkishText('QR kod oluştur'),
    toolIds: ['qr-barcode-suite'],
    description: 'QR kod veya barkod üretin ve hızlıca okutun',
    icon: 'qr-code-outline',
  },
];

export function findMatchingIntents(query: string): IntentAlias[] {
  if (!query.trim()) return [];
  return INTENT_ALIASES.filter(
    (alias) =>
      matchesTurkishQuery(alias.intent, query) ||
      (alias.description && matchesTurkishQuery(alias.description, query))
  );
}
