import { VcfContact, VcfPhone, VcfEmail } from './types';

export function escapeVcfValue(val?: string): string {
  if (!val) return '';
  return val.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function unescapeVcfValue(val?: string): string {
  if (!val) return '';
  return val.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

export function generateVcf(contacts: VcfContact[]): string {
  return contacts
    .map((c) => {
      const lines: string[] = [];
      lines.push('BEGIN:VCARD');
      lines.push('VERSION:3.0');

      const fn = c.formattedName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Adsız Kişi';
      lines.push(`FN:${escapeVcfValue(fn)}`);

      const lastName = escapeVcfValue(c.lastName || '');
      const firstName = escapeVcfValue(c.firstName || '');
      lines.push(`N:${lastName};${firstName};;;`);

      c.phoneNumbers.forEach((p) => {
        const typeStr = p.type ? `;TYPE=${p.type.toUpperCase()}` : ';TYPE=CELL';
        lines.push(`TEL${typeStr}:${escapeVcfValue(p.number)}`);
      });

      c.emails.forEach((e) => {
        const typeStr = e.type ? `;TYPE=${e.type.toUpperCase()}` : ';TYPE=WORK';
        lines.push(`EMAIL${typeStr}:${escapeVcfValue(e.email)}`);
      });

      if (c.organization) {
        lines.push(`ORG:${escapeVcfValue(c.organization)}`);
      }

      if (c.jobTitle) {
        lines.push(`TITLE:${escapeVcfValue(c.jobTitle)}`);
      }

      if (c.note) {
        lines.push(`NOTE:${escapeVcfValue(c.note)}`);
      }

      lines.push('END:VCARD');
      return lines.join('\r\n');
    })
    .join('\r\n\r\n');
}

export function parseVcf(vcfText: string): VcfContact[] {
  if (!vcfText) return [];

  // Unfold folded lines (lines starting with space or tab)
  const unfolded = vcfText.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');

  const vcardRegex = /BEGIN:VCARD[\s\S]*?END:VCARD/gi;
  const matches = unfolded.match(vcardRegex);

  if (!matches) return [];

  const contacts: VcfContact[] = [];

  matches.forEach((cardStr, index) => {
    const lines = cardStr.split(/\r?\n/);
    let fn = '';
    let lastName = '';
    let firstName = '';
    let org = '';
    let title = '';
    let note = '';
    const phones: VcfPhone[] = [];
    const emails: VcfEmail[] = [];

    lines.forEach((line) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return;

      const keyPart = line.substring(0, colonIdx).trim().toUpperCase();
      const valPart = line.substring(colonIdx + 1).trim();

      if (keyPart === 'FN') {
        fn = unescapeVcfValue(valPart);
      } else if (keyPart.startsWith('N') && !keyPart.startsWith('NOTE')) {
        const nParts = valPart.split(';');
        lastName = unescapeVcfValue(nParts[0] || '');
        firstName = unescapeVcfValue(nParts[1] || '');
      } else if (keyPart.startsWith('TEL')) {
        let type = 'CELL';
        if (keyPart.includes('HOME')) type = 'HOME';
        else if (keyPart.includes('WORK')) type = 'WORK';
        phones.push({ type, number: unescapeVcfValue(valPart) });
      } else if (keyPart.startsWith('EMAIL')) {
        let type = 'WORK';
        if (keyPart.includes('HOME')) type = 'HOME';
        emails.push({ type, email: unescapeVcfValue(valPart) });
      } else if (keyPart.startsWith('ORG')) {
        org = unescapeVcfValue(valPart);
      } else if (keyPart.startsWith('TITLE')) {
        title = unescapeVcfValue(valPart);
      } else if (keyPart.startsWith('NOTE')) {
        note = unescapeVcfValue(valPart);
      }
    });

    const formattedName = fn || [firstName, lastName].filter(Boolean).join(' ') || `Kişi #${index + 1}`;

    contacts.push({
      id: `imported-${Date.now()}-${index}`,
      formattedName,
      firstName,
      lastName,
      phoneNumbers: phones,
      emails,
      organization: org,
      jobTitle: title,
      note,
      selected: true,
    });
  });

  return contacts;
}

export const MOCK_CONTACTS_BACKUP: VcfContact[] = [
  {
    id: 'mock-1',
    formattedName: 'Ahmet Yılmaz',
    firstName: 'Ahmet',
    lastName: 'Yılmaz',
    phoneNumbers: [{ type: 'CELL', number: '+90 532 111 2233' }],
    emails: [{ type: 'WORK', number: '', email: 'ahmet@example.com' }],
    organization: 'Teknoloji A.Ş.',
    jobTitle: 'Yazılım Mühendisi',
    selected: true,
  },
  {
    id: 'mock-2',
    formattedName: 'Ayşe Kaya',
    firstName: 'Ayşe',
    lastName: 'Kaya',
    phoneNumbers: [{ type: 'CELL', number: '+90 542 999 8877' }],
    emails: [{ type: 'HOME', number: '', email: 'ayse.kaya@gmail.com' }],
    organization: 'Tasarım Stüdyosu',
    jobTitle: 'UX Tasarımcısı',
    selected: true,
  },
  {
    id: 'mock-3',
    formattedName: 'Mehmet Demir',
    firstName: 'Mehmet',
    lastName: 'Demir',
    phoneNumbers: [{ type: 'WORK', number: '+90 212 555 4433' }],
    emails: [{ type: 'WORK', number: '', email: 'mehmet.d@holding.com' }],
    organization: 'Global Holding',
    selected: true,
  },
];
