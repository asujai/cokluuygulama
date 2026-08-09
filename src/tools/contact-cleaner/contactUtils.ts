/**
 * Contact cleaning, normalization, duplicate grouping, and merging utilities.
 */

export interface ContactItem {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phoneNumbers: string[];
  emails: string[];
  company?: string;
}

export interface DuplicateGroup {
  id: string;
  type: 'phone' | 'email' | 'name' | 'incomplete';
  key: string;
  title: string;
  contacts: ContactItem[];
}

/**
 * Deterministic mock contact dataset for Web and test/demo mode.
 */
export const MOCK_CONTACTS: ContactItem[] = [
  {
    id: 'mock-1',
    name: 'Ahmet Yılmaz',
    firstName: 'Ahmet',
    lastName: 'Yılmaz',
    phoneNumbers: ['+90 532 111 2233'],
    emails: ['ahmet.yilmaz@example.com'],
    company: 'Teknoloji A.Ş.',
  },
  {
    id: 'mock-2',
    name: 'Ahmet Yılmaz',
    firstName: 'Ahmet',
    lastName: 'Yılmaz',
    phoneNumbers: ['05321112233'],
    emails: ['ahmet.personal@gmail.com'],
  },
  {
    id: 'mock-3',
    name: 'Elif Kaya',
    firstName: 'Elif',
    lastName: 'Kaya',
    phoneNumbers: ['+90 533 444 5566'],
    emails: ['elif.kaya@firma.com'],
  },
  {
    id: 'mock-4',
    name: 'Elif K.',
    firstName: 'Elif',
    lastName: 'K.',
    phoneNumbers: [],
    emails: ['elif.kaya@firma.com'],
  },
  {
    id: 'mock-5',
    name: 'Mehmet Demir',
    firstName: 'Mehmet',
    lastName: 'Demir',
    phoneNumbers: ['+90 (555) 777 8899'],
    emails: ['m.demir@mail.com'],
  },
  {
    id: 'mock-6',
    name: 'Mehmet Demir',
    firstName: 'Mehmet',
    lastName: 'Demir',
    phoneNumbers: ['05557778899'],
    emails: [],
  },
  {
    id: 'mock-7',
    name: 'Ayşe Çelik',
    firstName: 'Ayşe',
    lastName: 'Çelik',
    phoneNumbers: ['+90 542 333 4455'],
    emails: ['ayse.celik@domain.com'],
  },
  {
    id: 'mock-8',
    name: 'Ayşe Çelik',
    firstName: 'Ayşe',
    lastName: 'Çelik',
    phoneNumbers: ['+90 542 333 4455'],
    emails: ['ayse.celik@domain.com'],
  },
  {
    id: 'mock-9',
    name: 'Eksik Kayıt 1',
    phoneNumbers: [],
    emails: [],
  },
  {
    id: 'mock-10',
    name: 'Eksik Kayıt 2',
    phoneNumbers: [],
    emails: [],
  },
];

/**
 * Normalizes phone number to last 10 digits for matching.
 */
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Normalizes email address for matching.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalizes name for matching.
 */
export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
}

/**
 * Finds duplicate contacts grouped by phone numbers.
 */
export function groupDuplicatePhones(contacts: ContactItem[]): DuplicateGroup[] {
  const phoneMap = new Map<string, ContactItem[]>();

  for (const contact of contacts) {
    for (const rawPhone of contact.phoneNumbers) {
      const norm = normalizePhoneNumber(rawPhone);
      if (!norm) continue;
      if (!phoneMap.has(norm)) {
        phoneMap.set(norm, []);
      }
      const list = phoneMap.get(norm)!;
      if (!list.some((c) => c.id === contact.id)) {
        list.push(contact);
      }
    }
  }

  const groups: DuplicateGroup[] = [];
  let index = 1;
  phoneMap.forEach((list, normPhone) => {
    if (list.length > 1) {
      groups.push({
        id: `phone-group-${index++}`,
        type: 'phone',
        key: normPhone,
        title: `Telefon: ...${normPhone}`,
        contacts: list,
      });
    }
  });

  return groups;
}

/**
 * Finds duplicate contacts grouped by email addresses.
 */
export function groupDuplicateEmails(contacts: ContactItem[]): DuplicateGroup[] {
  const emailMap = new Map<string, ContactItem[]>();

  for (const contact of contacts) {
    for (const rawEmail of contact.emails) {
      const norm = normalizeEmail(rawEmail);
      if (!norm) continue;
      if (!emailMap.has(norm)) {
        emailMap.set(norm, []);
      }
      const list = emailMap.get(norm)!;
      if (!list.some((c) => c.id === contact.id)) {
        list.push(contact);
      }
    }
  }

  const groups: DuplicateGroup[] = [];
  let index = 1;
  emailMap.forEach((list, normEmail) => {
    if (list.length > 1) {
      groups.push({
        id: `email-group-${index++}`,
        type: 'email',
        key: normEmail,
        title: `E-posta: ${normEmail}`,
        contacts: list,
      });
    }
  });

  return groups;
}

/**
 * Finds duplicate contacts grouped by names.
 */
export function groupDuplicateNames(contacts: ContactItem[]): DuplicateGroup[] {
  const nameMap = new Map<string, ContactItem[]>();

  for (const contact of contacts) {
    const norm = normalizeName(contact.name);
    if (!norm) continue;
    if (!nameMap.has(norm)) {
      nameMap.set(norm, []);
    }
    const list = nameMap.get(norm)!;
    if (!list.some((c) => c.id === contact.id)) {
      list.push(contact);
    }
  }

  const groups: DuplicateGroup[] = [];
  let index = 1;
  nameMap.forEach((list, normName) => {
    if (list.length > 1) {
      groups.push({
        id: `name-group-${index++}`,
        type: 'name',
        key: normName,
        title: `İsim: ${list[0].name}`,
        contacts: list,
      });
    }
  });

  return groups;
}

/**
 * Finds incomplete contacts (no phone numbers AND no emails).
 */
export function groupIncompleteContacts(contacts: ContactItem[]): DuplicateGroup[] {
  const incomplete = contacts.filter(
    (c) => c.phoneNumbers.length === 0 && c.emails.length === 0
  );

  if (incomplete.length === 0) return [];

  return [
    {
      id: 'incomplete-group',
      type: 'incomplete',
      key: 'incomplete',
      title: 'Eksik Kişiler (Telefon veya E-posta yok)',
      contacts: incomplete,
    },
  ];
}

/**
 * Merges multiple contacts into a single unified contact.
 */
export function mergeContacts(groupContacts: ContactItem[]): ContactItem {
  if (groupContacts.length === 0) {
    throw new Error('Birleştirilecek kişi seçilmedi');
  }

  // Name: pick non-empty name with max length or first
  const name =
    groupContacts.map((c) => c.name).filter(Boolean).sort((a, b) => b.length - a.length)[0] ||
    'Birleştirilmiş Kişi';

  // Merge unique phone numbers
  const phonesSet = new Set<string>();
  groupContacts.forEach((c) => c.phoneNumbers.forEach((p) => phonesSet.add(p)));

  // Merge unique emails
  const emailsSet = new Set<string>();
  groupContacts.forEach((c) => c.emails.forEach((e) => emailsSet.add(e)));

  const company = groupContacts.find((c) => c.company)?.company;

  return {
    id: groupContacts[0].id,
    name,
    phoneNumbers: Array.from(phonesSet),
    emails: Array.from(emailsSet),
    company,
  };
}
