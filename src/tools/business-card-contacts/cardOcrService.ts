import Tesseract from 'tesseract.js';
import * as Contacts from 'expo-contacts';
import { CardOcrProgress, ExtractedContact } from './types';

/**
 * Recognizes text from business card image and parses fields heuristically.
 */
export async function scanBusinessCard(
  imageUri: string,
  onProgress?: (progress: CardOcrProgress) => void
): Promise<ExtractedContact> {
  let rawText = '';

  try {
    const result = await Tesseract.recognize(imageUri, 'tur+eng', {
      logger: (m) => {
        if (onProgress && typeof m.progress === 'number') {
          let label = 'Kartvizit ayrıştırılıyor...';
          if (m.status.includes('loading')) label = 'OCR Modeli Yükleniyor...';
          if (m.status.includes('recognizing')) label = 'Metin Taranıyor...';
          onProgress({ status: label, progress: m.progress });
        }
      },
    });

    rawText = result.data.text.trim();
  } catch (err) {
    // Fallback to 'eng' if tur+eng is unavailable offline
    try {
      const result = await Tesseract.recognize(imageUri, 'eng', {
        logger: (m) => {
          if (onProgress && typeof m.progress === 'number') {
            onProgress({ status: 'Metin Taranıyor (Yedek)...', progress: m.progress });
          }
        },
      });
      rawText = result.data.text.trim();
    } catch (fallbackErr) {
      console.error('Card OCR failed:', fallbackErr);
      throw new Error('Kartvizit okunamadı. Lütfen görüntünün net olduğundan emin olun.');
    }
  }

  return parseBusinessCardText(rawText);
}

/**
 * Parses raw OCR text into structured ExtractedContact fields using regex & heuristics.
 */
export function parseBusinessCardText(rawText: string): ExtractedContact {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let email = '';
  let phone = '';
  let website = '';
  let company = '';
  let jobTitle = '';
  let firstName = '';
  let lastName = '';
  const addressLines: string[] = [];
  const noteLines: string[] = [];

  // Regex patterns
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
  const phoneRegex = /(\+?\d{1,4}[\s.-]?)?\(?\d{3,4}\)?[\s.-]?\d{3}[\s.-]?\d{2,4}/;
  const urlRegex = /(https?:\/\/)?(www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
  const companyKeywords = ['a.ş', 'ltd', 'inc', 'corp', 'holding', 'teknoloji', 'yazılım', 'sanayi', 'ticaret', 'group', 'studio', 'ajans'];
  const titleKeywords = ['mühendis', 'mimar', 'direktör', 'director', 'manager', 'müdür', 'uzman', 'ceo', 'cto', 'kurucu', 'founder', 'geliştirici', 'developer', 'tasarımcı', 'designer', 'consultant', 'danışman'];
  const addressKeywords = ['cad', 'sok', 'mah', 'no:', 'kat:', 'blok', 'plaza', 'mrk', 'merkez', 'istanbul', 'ankara', 'izmir', 'türkiye', 'turkey'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Email extraction
    if (!email && emailRegex.test(line)) {
      const match = line.match(emailRegex);
      if (match) email = match[0];
      continue;
    }

    // 2. Phone extraction
    if (!phone && phoneRegex.test(line) && !line.toLowerCase().includes('fax')) {
      const match = line.match(phoneRegex);
      if (match && match[0].replace(/\D/g, '').length >= 7) {
        phone = match[0].trim();
        continue;
      }
    }

    // 3. Website extraction
    if (!website && urlRegex.test(line) && !line.includes('@')) {
      const match = line.match(urlRegex);
      if (match) website = match[0];
      continue;
    }

    const lower = line.toLowerCase();

    // 4. Company extraction
    if (!company && companyKeywords.some((k) => lower.includes(k))) {
      company = line;
      continue;
    }

    // 5. Job Title extraction
    if (!jobTitle && titleKeywords.some((k) => lower.includes(k))) {
      jobTitle = line;
      continue;
    }

    // 6. Address extraction
    if (addressKeywords.some((k) => lower.includes(k))) {
      addressLines.push(line);
      continue;
    }

    // 7. Name heuristic (usually early in business card lines, 2-3 words, no numbers)
    if (!firstName && !/\d/.test(line) && line.split(' ').length <= 4 && line.length < 40) {
      const parts = line.split(' ').filter(Boolean);
      if (parts.length >= 2) {
        lastName = parts.pop() || '';
        firstName = parts.join(' ');
        continue;
      } else if (parts.length === 1) {
        firstName = parts[0];
        continue;
      }
    }

    // Uncategorized lines go to notes
    noteLines.push(line);
  }

  // Fallback for company if first line is bold/capitalized
  if (!company && lines.length > 0 && !firstName.includes(lines[0])) {
    company = lines[0];
  }

  return {
    firstName: firstName || 'Kartvizit',
    lastName: lastName || 'Kişisi',
    phone: phone || '',
    email: email || '',
    company: company || '',
    jobTitle: jobTitle || '',
    website: website || '',
    address: addressLines.join(', ') || '',
    notes: noteLines.join('\n') || '',
    rawOcrText: rawText,
  };
}

/**
 * Save extracted contact to native Expo Contacts with permission check.
 */
export async function saveToNativeContacts(contact: ExtractedContact): Promise<boolean> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Rehber izni verilmedi. Lütfen ayarlarınızdan izin tanımlayınız.');
    }

    const newContact: Contacts.Contact = {
      contactType: Contacts.ContactTypes.Person,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
      [Contacts.Fields.FirstName]: contact.firstName,
      [Contacts.Fields.LastName]: contact.lastName,
      [Contacts.Fields.Company]: contact.company || undefined,
      [Contacts.Fields.JobTitle]: contact.jobTitle || undefined,
    };

    if (contact.phone) {
      newContact[Contacts.Fields.PhoneNumbers] = [
        {
          label: 'mobile',
          number: contact.phone,
        },
      ];
    }

    if (contact.email) {
      newContact[Contacts.Fields.Emails] = [
        {
          label: 'work',
          email: contact.email,
        },
      ];
    }

    if (contact.website) {
      newContact[Contacts.Fields.UrlAddresses] = [
        {
          label: 'work',
          url: contact.website,
        },
      ];
    }

    if (contact.address) {
      newContact[Contacts.Fields.Addresses] = [
        {
          label: 'work',
          street: contact.address,
        },
      ];
    }

    if (contact.notes) {
      newContact[Contacts.Fields.Note] = contact.notes;
    }

    const contactId = await Contacts.addContactAsync(newContact);
    return !!contactId;
  } catch (err) {
    console.error('Save to native contacts failed:', err);
    throw err;
  }
}
