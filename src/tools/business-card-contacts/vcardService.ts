import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { ExtractedContact } from './types';

/**
 * Generates vCard (VCF 3.0) string format from contact data.
 */
export function generateVCardString(contact: ExtractedContact): string {
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${contact.lastName};${contact.firstName};;;`,
    `FN:${fullName || 'Kartvizit Kişisi'}`,
  ];

  if (contact.company) lines.push(`ORG:${contact.company}`);
  if (contact.jobTitle) lines.push(`TITLE:${contact.jobTitle}`);
  if (contact.phone) lines.push(`TEL;TYPE=CELL,VOICE:${contact.phone}`);
  if (contact.email) lines.push(`EMAIL;TYPE=WORK,INTERNET:${contact.email}`);
  if (contact.website) lines.push(`URL:${contact.website}`);
  if (contact.address) lines.push(`ADR;TYPE=WORK:;;${contact.address.replace(/\n/g, ', ')};;;;`);
  if (contact.notes) lines.push(`NOTE:${contact.notes.replace(/\n/g, ' ')}`);

  lines.push('END:VCARD');
  return lines.join('\n');
}

/**
 * Export and share vCard (.vcf file).
 */
export async function exportVCardFile(contact: ExtractedContact): Promise<void> {
  const vcardText = generateVCardString(contact);
  const fileName = `${(contact.firstName || 'kisi').toLowerCase()}_${(contact.lastName || 'kartvizit').toLowerCase()}.vcf`;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([vcardText], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  try {
    const cacheDir = FileSystem.Paths.cache.uri.endsWith('/')
      ? FileSystem.Paths.cache.uri
      : `${FileSystem.Paths.cache.uri}/`;
    const fileUri = `${cacheDir}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, vcardText, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/vcard',
        dialogTitle: 'vCard Dosyasını Paylaş',
      });
    } else {
      throw new Error('Cihazınızda paylaşım desteklenmiyor.');
    }
  } catch (err) {
    console.error('vCard export failed:', err);
    throw err;
  }
}
